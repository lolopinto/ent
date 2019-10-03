package ent

import (
	"fmt"
	"reflect"

	"github.com/jmoiron/sqlx"
	"github.com/jmoiron/sqlx/reflectx"
	"github.com/pkg/errors"
)

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
	GetEntity() dataEntity
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
	// 1 dataEntity
	// 2 reflect.Value in which underlying element is a dataEntity, specifically has a DBFields() method which can be called via reflection
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

	// handle loaders that have multiple items that can be cached
	// and check to see if we need to hit db
	multiInputLoader, ok := l.(multiInputLoader)
	if ok {
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
	if ok {
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
	return q.StructScanRows(l)
}

func fillEntityFromMap(entity dataEntity, dataMap map[string]interface{}) error {
	return fillEntityFromFields(entity.DBFields(), dataMap)
}

func fillEntityFromFields(fields DBFields, dataMap map[string]interface{}) error {
	for k, v := range dataMap {
		fieldFunc, ok := fields[k]
		if !ok {
			// todo throw an exception eventually. for now this exists for created_at and updadted_at which may not be there
			fmt.Println("field retrieved from database which has no func")
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
	entity, ok := instance.(dataEntity)
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

	// loader supports a cache. check it out
	cacheable, ok := l.(cachedLoader)
	if ok {
		// handle cache access
		key := cacheable.GetCacheKey()

		fn := func() (map[string]interface{}, error) {
			dataMap := make(map[string]interface{})
			fmt.Println("cache miss for key", key)

			// query and scan into map. return data in format needed by cache function
			err := q.MapScan(dataMap)
			return dataMap, err
		}

		actual, err := getItemFromCacheMaybe(key, fn)
		if err != nil {
			return err
		}
		return fillEntityFromMap(l.GetEntity(), actual)
	}

	return q.StructScan(l)
}

// TODO figure out if this is the right long term API
type loadNodeFromPartsLoader struct {
	config Config
	parts  []interface{}
	entity dataEntity
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

func (l *loadNodeFromPartsLoader) GetEntity() dataEntity {
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
	entity    dataEntity
}

func (l *loadNodeFromPKey) GetSQLBuilder() (*sqlBuilder, error) {
	pKey := "id"
	entityWithPkey, ok := l.entity.(dataEntityWithDiffPKey)
	if ok {
		pKey = entityWithPkey.GetPrimaryKey()
	}
	return &sqlBuilder{
		entity:    l.entity,
		tableName: l.tableName,
		whereParts: []interface{}{
			pKey,
			l.id,
		},
	}, nil
}

func (l *loadNodeFromPKey) GetEntity() dataEntity {
	return l.entity
}

func (l *loadNodeFromPKey) GetCacheKey() string {
	return getKeyForNode(l.id, l.tableName)
}

type loadEdgesByType struct {
	id         string
	edgeType   EdgeType
	edges      []*Edge
	outputID2s bool
}

func (l *loadEdgesByType) GetSQLBuilder() (*sqlBuilder, error) {
	// TODO make chainable?
	edgeData, err := getEdgeInfo(l.edgeType, nil)
	if err != nil {
		return nil, err
	}

	// TODO: eventually add support for complex queries
	// ORDER BY time DESC default
	// we need offset, limit eventuall

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
	}, nil
}

func (l *loadEdgesByType) GetCacheKey() string {
	return getKeyForEdge(l.id, l.edgeType)
}

func (l *loadEdgesByType) GetNewInstance() interface{} {
	var edge Edge
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

func (l *loadEdgesByType) LoadData() ([]*Edge, error) {
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

func (l *loadAssocEdgeConfigExists) GetEntity() dataEntity {
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

type loadMultipleNodesFromQuery struct {
	sqlBuilder *sqlBuilder
	nodes      interface{}
	// private...
	base   reflect.Type
	direct *reflect.Value
}

func (l *loadMultipleNodesFromQuery) GetSQLBuilder() (*sqlBuilder, error) {
	return l.sqlBuilder, nil
}

func (l *loadMultipleNodesFromQuery) Validate() error {
	slice, direct, err := validateSliceOfNodes(l.nodes)
	if err != nil {
		return err
	}
	l.direct = direct
	l.base = reflectx.Deref(slice.Elem())
	return err
}

func (l *loadMultipleNodesFromQuery) GetNewInstance() interface{} {
	entity := reflect.New(l.base)

	l.direct.Set(reflect.Append(*l.direct, entity))

	return entity
}

type loadMultipleNodesFromQueryNodeDependent struct {
	loadMultipleNodesFromQuery
}

func (l *loadMultipleNodesFromQueryNodeDependent) GetSQLBuilder() (*sqlBuilder, error) {
	if l.base == nil {
		return nil, errors.New("validate wasn't called or don't have the right data")
	}
	if l.sqlBuilder == nil {
		return nil, errors.New("sqlbuilder required")
	}
	value := reflect.New(l.base)
	fields := getFieldsFromReflectValue(value)
	// pass fields to determine which columns to query
	l.sqlBuilder.fields = fields
	return l.sqlBuilder, nil
}

type loadNodesLoader struct {
	ids []string
	//	edgeType  EdgeType
	//	nodes     interface{}
	entConfig Config
	loadMultipleNodesFromQueryNodeDependent
}

func (l *loadNodesLoader) Validate() error {
	err := l.loadMultipleNodesFromQueryNodeDependent.Validate()
	if err != nil {
		return err
	}
	if len(l.ids) == 0 {
		return errors.New("chainable loader didn't pass any ids")
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

func (l *loadNodesLoader) GetSQLBuilder() (*sqlBuilder, error) {
	// TODO handle this better
	if l.sqlBuilder == nil {
		l.sqlBuilder = &sqlBuilder{
			tableName: l.entConfig.GetTableName(),
		}
	}
	if len(l.ids) == 0 {
		return nil, errors.New("shouldn't call GetSQLBuilder() if there are no ids")
	}

	// get the sql builder from composited object and then override it to pass i
	builder, err := l.loadMultipleNodesFromQueryNodeDependent.GetSQLBuilder()

	if err != nil {
		return nil, err
	}

	inArgs := make([]interface{}, len(l.ids))
	for idx, id := range l.ids {
		inArgs[idx] = id
	}
	builder.in("id", inArgs)
	return builder, nil
}

func (l *loadNodesLoader) GetCacheKeyForID(id string) string {
	return getKeyForNode(id, l.entConfig.GetTableName())
}
