package ent

import (
	"fmt"
	"reflect"

	"github.com/jmoiron/sqlx"
	"github.com/pkg/errors"
)

var cacheEnabled = true

// DisableCache disables the default in-memory cache. this is not thread safe
// TODO: provide better options for this and ways to configure memory/redis/etc
func DisableCache() {
	cacheEnabled = false
}

// EnableCache enables the in-memory cache. inverse of EnableCache
func EnableCache() {
	cacheEnabled = true
}

type loader interface {
	GetSQLBuilder() (*sqlBuilder, error)
}

type cachedLoader interface {
	loader
	GetCacheKey() string
}

type validatedLoader interface {
	loader
	Validate() error
}

type singleRowLoader interface {
	loader
	GetEntity() DBObject
}

// a loader that can be chained with other loaders and receives input from other loaders
type chainableInputLoader interface {
	loader
	SetInput(interface{}) error
}

// a loader that can be chained with other loaders and passes output to other loaders
type chainableOutputLoader interface {
	loader
	GetOutput() interface{} // should return nil to indicate not to call next loader
}

type multiRowLoader interface {
	loader
	// GetNewInstance returns a new instance of the item being read from the database
	// Two supported types:
	// 1 DBObject
	// 2 reflect.Value in which underlying element is a DBObject, specifically has a DBFields() method which can be called via reflection
	// when it's a reflect.Value(), StructScan() will be called with the underlying Interface() method
	// we want reflect.Value to know when to use reflection vs not
	// It's expected that the item is also appended to the internal slice which is used to keep track
	// of the items retrieved when returned.

	GetNewInstance() interface{}
}

// hmm.
// for now coupling this but this may not always be true...
type multiInputLoader interface {
	// this handles going through the inputs, figuring out what's cached first and then limiting the query to only those that are not in the cache and
	// then after fetching from the db, storing cached item based on the CacheKey returned
	multiRowLoader
	GetInputIDs() []string
	LimitQueryTo(ids []string)
	// GetCacheKeyForID assumes the key is dependent on the id
	// Called For each inputID to see if we can hit the cache for that id and then called for each id retrieved from the database to store in cache
	GetCacheKeyForID(id string) string
	IsMultiInputLoader() bool
}

// terrible name
type abortEarlyLoader interface {
	loader
	AbortEarly() bool
}

type loaderConfig struct {
	tx *sqlx.Tx
	// TODO disable
	//	disableCache bool
}

func cfgtx(tx *sqlx.Tx) func(*loaderConfig) {
	return func(cfg *loaderConfig) {
		cfg.tx = tx
	}
}

func loadData(l loader, options ...func(*loaderConfig)) error {
	cfg := &loaderConfig{}
	for _, opt := range options {
		opt(cfg)
	}

	// validate the loader
	validator, ok := l.(validatedLoader)
	if ok {
		if err := validator.Validate(); err != nil {
			return err
		}
	}

	// if the loader gets something like an empty string and we don't want to send an error,
	// we can save load on the db by not wasting a query and we don't wanna return an error
	abortEarly, ok := l.(abortEarlyLoader)
	if ok && abortEarly.AbortEarly() {
		return nil
	}

	// handle loaders that have multiple items that can be cached
	// and check to see if we need to hit db
	multiInputLoader, ok := l.(multiInputLoader)
	if ok && multiInputLoader.IsMultiInputLoader() {
		ids, err := checkCacheForMultiInputLoader(multiInputLoader)
		if err != nil {
			return err
		}
		// nothing to do here
		if len(ids) == 0 {
			return nil
		}
	}

	q := &dbQuery{
		cfg: cfg,
		l:   l,
	}

	multiRowLoader, ok := l.(multiRowLoader)
	if ok {
		return loadMultiRowData(multiRowLoader, q)
	}
	singleRowLoader, ok := l.(singleRowLoader)
	if ok {
		return loadRowData(singleRowLoader, q)
	}
	panic("invalid loader passed")
}

func checkCacheForMultiInputLoader(l multiInputLoader) ([]string, error) {
	var ids []string
	for _, inputID := range l.GetInputIDs() {
		cachedItem, err := getItemInCache(
			l.GetCacheKeyForID(inputID),
		)
		if err != nil {
			fmt.Println("error getting cached item", err)
			return nil, err
		}
		if cachedItem != nil {
			// TODO we need to care about correct order but for now whatever
			fillInstance(l, cachedItem)
		} else {
			ids = append(ids, inputID)
		}
	}

	if len(ids) != 0 {
		l.LimitQueryTo(ids)
	}
	return ids, nil
}

func chainLoaders(loaders []loader, options ...func(*loaderConfig)) error {
	///	length := len(loaders)
	var output interface{}

	for idx, l := range loaders {
		inputLoader, ok := l.(chainableInputLoader)

		if ok {
			if idx == 0 {
				panic("first loader cannot require an input")
			}

			if output == nil {
				panic("loader requires an input but no input to pass in")
			}
			inputLoader.SetInput(output)
		}

		// call loader
		err := loadData(l, options...)
		if err != nil {
			return err
		}

		outputLoader, ok := l.(chainableOutputLoader)
		if ok {
			output = outputLoader.GetOutput()

			// no error but we're done here. nothing to pass along
			if output == nil {
				return nil
			}

		} else {
			output = nil
		}
	}
	if output != nil {
		panic("ended with an output loader which didn't do anything with it")
	}
	return nil
}

func loadMultiRowData(l multiRowLoader, q *dbQuery) error {
	cacheable, ok := l.(cachedLoader)
	if ok && cacheEnabled {
		key := cacheable.GetCacheKey()

		fn := func() ([]map[string]interface{}, error) {
			return q.MapScanRows()
		}

		actual, err := getItemsFromCacheMaybe(key, fn)
		if err != nil {
			return err
		}
		for idx := range actual {
			err := fillInstance(l, actual[idx])
			if err != nil {
				return err
			}
		}
		return nil
	}
	multiCacheable, ok := l.(multiInputLoader)
	if ok {
		return q.MapScanAndFillRows(multiCacheable)
	}
	// TODO fix TestLoadingRawMultiNodesWithJSON in models_test
	return q.StructScanRows(l)
}

func fillEntityFromMap(entity DBObject, dataMap map[string]interface{}) error {
	return fillEntityFromFields(entity.DBFields(), dataMap)
}

func fillEntityFromFields(fields DBFields, dataMap map[string]interface{}) error {
	for k, v := range dataMap {
		fieldFunc, ok := fields[k]
		if !ok {
			// todo throw an exception eventually. for now this exists for created_at and updadted_at which may not be there
			//			fmt.Printf("field %s retrieved from database which has no func \n", k)
			continue
		}
		err := fieldFunc(v)
		if err != nil {
			return err
		}
	}
	return nil
}

func fillInstance(l multiRowLoader, dataMap map[string]interface{}) error {
	instance := l.GetNewInstance()
	entity, ok := instance.(DBObject)
	if ok {
		return fillEntityFromMap(entity, dataMap)
	}

	value, ok := instance.(reflect.Value)
	if !ok {
		panic("invalid item returned from loader.GetNewInstance()")
	}

	fields := getFieldsFromReflectValue(value)
	return fillEntityFromFields(fields, dataMap)
}

func getFieldsFromReflectValue(value reflect.Value) DBFields {
	// DBFields reflection time
	method := reflect.ValueOf(value.Interface()).MethodByName("DBFields")
	if !method.IsValid() {
		panic("method DBFields doesn't exist on passed in item")
	}
	res := method.Call([]reflect.Value{})
	if len(res) != 1 {
		panic("invalid number of results. DBFields should have returned 1 item")
	}
	val := res[0].Interface()
	fields, ok := val.(DBFields)
	if !ok {
		panic("invalid value returned from DBFields")
	}
	return fields
}

func loadRowData(l singleRowLoader, q *dbQuery) error {
	if l.GetEntity() == nil {
		return errors.New("nil entity passed to loadData")
	}

	fn := func() (map[string]interface{}, error) {
		return mapScan(q)
	}

	// loader supports a cache. check it out
	cacheable, ok := l.(cachedLoader)
	if ok && cacheEnabled {
		// handle cache access
		key := cacheable.GetCacheKey()

		actual, err := getItemFromCacheMaybe(key, fn)
		if err != nil {
			return err
		}
		return fillEntityFromMap(l.GetEntity(), actual)
	}

	return queryRow(q, l.GetEntity())
}

// TODO figure out if this is the right long term API
type loadNodeFromPartsLoader struct {
	config Config
	parts  []interface{}
	entity DBObject
}

func (l *loadNodeFromPartsLoader) Validate() error {
	if len(l.parts) < 2 {
		return errors.New("invalid number of parts passed")
	}

	if len(l.parts)%2 != 0 {
		return errors.New("expected even number of parts, got and odd number")
	}
	return nil
}

func (l *loadNodeFromPartsLoader) GetEntity() DBObject {
	return l.entity
}

func (l *loadNodeFromPartsLoader) GetSQLBuilder() (*sqlBuilder, error) {
	return &sqlBuilder{
		entity:     l.entity,
		tableName:  l.config.GetTableName(),
		whereParts: l.parts,
	}, nil
}

type loadNodeFromPKey struct {
	id        string
	tableName string
	entity    DBObject
}

func getPrimaryKeyForObj(entity DBObject) string {
	pKey := "id"
	entityWithPkey, ok := entity.(dataEntityWithDiffPKey)
	if ok {
		pKey = entityWithPkey.GetPrimaryKey()
	}
	return pKey
}

func (l *loadNodeFromPKey) GetSQLBuilder() (*sqlBuilder, error) {
	return &sqlBuilder{
		entity:    l.entity,
		tableName: l.tableName,
		whereParts: []interface{}{
			getPrimaryKeyForObj(l.entity),
			l.id,
		},
	}, nil
}

func (l *loadNodeFromPKey) GetEntity() DBObject {
	return l.entity
}

func (l *loadNodeFromPKey) GetCacheKey() string {
	return getKeyForNode(l.id, l.tableName)
}

type loadEdgesByType struct {
	id         string
	edgeType   EdgeType
	edges      []*AssocEdge
	outputID2s bool
	options    []func(*LoadEdgeConfig)
	cfg        LoadEdgeConfig
}

func (l *loadEdgesByType) AbortEarly() bool {
	return l.id == ""
}

func (l *loadEdgesByType) GetSQLBuilder() (*sqlBuilder, error) {
	// TODO make chainable?
	edgeData, err := GetEdgeInfo(l.edgeType, nil)
	if err != nil {
		return nil, err
	}

	// TODO: eventually add support for complex queries
	// ORDER BY time DESC default
	// we need offset, limit eventually

	for _, opt := range l.options {
		opt(&l.cfg)
	}

	return &sqlBuilder{
		colsString: "*",
		tableName:  edgeData.EdgeTable,
		whereParts: []interface{}{
			"id1",
			l.id,
			"edge_type",
			l.edgeType,
		},
		order: "time DESC",
		limit: l.cfg.limit,
	}, nil
}

func (l *loadEdgesByType) GetCacheKey() string {
	return getKeyForEdge(l.id, l.edgeType) + l.cfg.getKey()
}

func (l *loadEdgesByType) GetNewInstance() interface{} {
	var edge AssocEdge
	l.edges = append(l.edges, &edge)
	return &edge
}

func (l *loadEdgesByType) GetOutput() interface{} {
	// nothing to do here
	if len(l.edges) == 0 {
		return nil
	}

	if l.outputID2s {
		ids := make([]string, len(l.edges))
		for idx, edge := range l.edges {
			ids[idx] = edge.ID2
		}
		return ids
	}
	return l.edges
}

func (l *loadEdgesByType) LoadData() ([]*AssocEdge, error) {
	err := loadData(l)
	if err != nil {
		return nil, err
	}
	return l.edges, nil
}

type nodeExists struct {
	Exists bool `db:"exists"`
}

func (n *nodeExists) DBFields() DBFields {
	panic("should never be called since not cacheable")
}

type loadAssocEdgeConfigExists struct {
	n nodeExists
}

func (l *loadAssocEdgeConfigExists) GetSQLBuilder() (*sqlBuilder, error) {
	return &sqlBuilder{
		rawQuery: "SELECT to_regclass($1) IS NOT NULL as exists",
		rawValues: []interface{}{
			"assoc_edge_config",
		},
	}, nil
}

func (l *loadAssocEdgeConfigExists) GetEntity() DBObject {
	return &l.n
}

func (l *loadAssocEdgeConfigExists) GetOutput() interface{} {
	// has an output that's not necessary passable. just indicates whether we should continue
	// so GetOutput has 2 different meanings. This should mean continue chaining vs input/output
	// maybe decouple this later?
	if l.n.Exists {
		return l.n.Exists
	}
	return nil
}

// TODO collapse this into same loader as above
// kill fromPartsLoader collapse into this and have a limit 1
type loadNodesLoader struct {
	// todo combine these 3 (and others) into sqlBuilder options of some sort
	whereParts []interface{}
	ids        []string
	rawQuery   string
	entLoader  MultiEntLoader
	dbobjects  []DBObject
}

func (l *loadNodesLoader) Validate() error {
	if l.entLoader == nil {
		return errors.New("loader required")
	}

	if len(l.ids) == 0 && len(l.whereParts) == 0 && l.rawQuery == "" {
		return errors.New("no ids passed to loadNodesLoader or no way to query as needed")
	}
	return nil
}

func (l *loadNodesLoader) SetInput(val interface{}) error {
	ids, ok := val.([]string)
	if !ok {
		return errors.New("invalid input passed to loadNodesLoader")
	}
	l.ids = ids
	return nil
}

func (l *loadNodesLoader) GetInputIDs() []string {
	return l.ids
}

func (l *loadNodesLoader) LimitQueryTo(ids []string) {
	l.ids = ids
}

func (l *loadNodesLoader) GetNewInstance() interface{} {
	node := l.entLoader.GetNewInstance()
	l.dbobjects = append(l.dbobjects, node)
	return node
}

func (l *loadNodesLoader) GetSQLBuilder() (*sqlBuilder, error) {
	builder := &sqlBuilder{
		tableName: l.entLoader.GetConfig().GetTableName(),
	}

	// TODO we should just set as needed and leave it to builder
	// to determine if valid or not
	if len(l.ids) != 0 {
		inArgs := make([]interface{}, len(l.ids))
		for idx, id := range l.ids {
			inArgs[idx] = id
		}
		builder.in("id", inArgs)
	} else if len(l.whereParts) != 0 {
		builder.whereParts = l.whereParts
	} else if l.rawQuery != "" {
		builder.rawQuery = l.rawQuery
	} else {
		return nil, errors.New("shouldn't call GetSQLBuilder() if there are no ids or parts")
	}

	return builder, nil
}

func (l *loadNodesLoader) GetCacheKeyForID(id string) string {
	return getKeyForNode(id, l.entLoader.GetConfig().GetTableName())
}

func (l *loadNodesLoader) IsMultiInputLoader() bool {
	// if either of these flags were set, not the case we care about
	if len(l.whereParts) != 0 || l.rawQuery != "" {
		return false
	}
	return true
}
