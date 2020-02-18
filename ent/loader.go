package ent

import (
	"fmt"

	"github.com/jmoiron/sqlx"
	"github.com/lolopinto/ent/ent/cast"
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

// TODO rename to dataLoader or something to differentiate from (Ent)Loader
type loader interface {
	GetSQLBuilder() (*sqlBuilder, error)
}

// works for both 1-N and 1-1 queries depending on context
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
	GetNewInstance() DBObject
}

type configureQueryResult struct {
	config configureQuery
	errs   []error
}

type configureQuery int

const (
	continueQuery configureQuery = 1
	cancelQuery   configureQuery = 2
	errorQuery    configureQuery = 3
)

func configureWith(config configureQuery, errs ...error) configureQueryResult {
	res := configureQueryResult{config: config}
	res.errs = errs
	return res
}

type customMultiLoader interface {
	ProcessRows() func(rows *sqlx.Rows) error
}

type configurableLoader interface {
	Configure() configureQueryResult
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

	// any configurations (not best name) or anything (cache, wrong id etc) that'll
	// prevent us from hitting the db?
	configurable, ok := l.(configurableLoader)
	if ok {
		res := configurable.Configure()

		switch res.config {
		case cancelQuery:
			return nil
		case errorQuery:
			if len(res.errs) == 0 {
				panic("errorQuery returned without specifying errors")
			}
			// get error and return it
			return CoalesceErr(res.errs...)

		default:
			// continue and move on...
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
		// 1 key -> N items e.g. edge?
		// this is generic enough that we can support
		key := cacheable.GetCacheKey()

		fn := func() ([]map[string]interface{}, error) {
			return q.MapScanRows()
		}

		actual, err := getItemsFromCacheMaybe(key, fn)
		if err != nil {
			return err
		}
		for idx := range actual {
			err := fillFromCacheItem(l, actual[idx])
			if err != nil {
				return err
			}
		}
		return nil
	}

	custom, ok := l.(customMultiLoader)
	if ok {
		return q.customProcessRows(custom.ProcessRows())
	}

	// we still need to fix this edge case where it's an object with json and we shouldn't
	// struct scan. we need a way to say we should mapscan instead
	// UnsupportedScan for generated loader eventually needed
	return q.StructScanRows(l)
}

func fillEntityFromMap(entity DBObject, dataMap map[string]interface{}) error {
	fields := entity.DBFields()
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

func fillFromCacheItem(l multiRowLoader, dataMap map[string]interface{}) error {
	instance := l.GetNewInstance()
	return fillEntityFromMap(instance, dataMap)
}

func loadRowData(l singleRowLoader, q *dbQuery) error {
	if l.GetEntity() == nil {
		return errors.New("nil entity passed to loadData")
	}

	// loader supports a cache. check it out
	cacheable, ok := l.(cachedLoader)
	if ok && cacheEnabled {
		// handle cache access
		key := cacheable.GetCacheKey()

		fn := func() (map[string]interface{}, error) {
			return mapScan(q)
		}

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
	entityWithPkey, ok := entity.(DBObjectWithDiffKey)
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

func (l *loadEdgesByType) Configure() configureQueryResult {
	// If no id, no need to actually hit the database.
	if l.id == "" {
		return configureWith(cancelQuery)
	}
	// continue on
	return configureWith(continueQuery)
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

func (l *loadEdgesByType) GetNewInstance() DBObject {
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

func (n *nodeExists) GetID() string {
	panic("whaa")
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

// kill fromPartsLoader collapse into this and have a limit 1
type loadNodesLoader struct {
	// todo combine these 3 (and others) into sqlBuilder options of some sort
	whereParts []interface{}
	ids        []string
	rawQuery   string
	entLoader  Loader
	dbobjects  []DBObject
	queryIDs   []string // ids we're fetching from db
	rawData    bool     // flat that indicates we're fetching raw data and not going through
	// privacy layer. we'll never struct scan and data will be in dataRows
	// use if you want rawData for built in ents or have custom loaders where you're accumulating each
	// call to loader.GetNewInstance() and storing that yourself
	// We don't do that in the generated loaders because we want privacy aware data eventually
	dataRows []map[string]interface{}
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

func (l *loadNodesLoader) GetNewInstance() DBObject {
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

func (l *loadNodesLoader) Configure() configureQueryResult {
	// not loading a bunch of ids which may have a cache and all that complex stuff. simplify
	if len(l.whereParts) != 0 || l.rawQuery != "" {
		return configureWith(continueQuery)
	}

	// if we ever need this logic reused. we can break this up
	// with composition instead of trying to handle all the complex cases
	// generically in main path

	var queryIDs []string
	for _, inputID := range l.ids {
		cachedItem, err := getItemInCache(
			l.GetCacheKeyForID(inputID),
		)
		if err != nil {
			fmt.Println("error getting cached item", err)
			return configureWith(errorQuery, err)
		}

		if cachedItem != nil {
			// TODO we need to care about correct order but for now whatever
			fillFromCacheItem(l, cachedItem)
		} else {
			queryIDs = append(queryIDs, inputID)
		}
	}
	l.queryIDs = queryIDs

	// nothing to fetch, we're done
	if len(queryIDs) == 0 {
		return configureWith(cancelQuery)
	}
	return configureWith(continueQuery)
}

func (l *loadNodesLoader) ProcessRows() func(rows *sqlx.Rows) error {
	if l.rawData {
		return mapScanRows(&l.dataRows)
	}

	// whereParts or rawQuery structScan
	// not quite accurate since we need unsupportedscan logic here
	if len(l.queryIDs) == 0 || !cacheEnabled {
		return structScanRows(l)
	}

	// multi-ids and cache enabled, check for cache.
	return func(rows *sqlx.Rows) error {
		for rows.Next() {
			dataMap := make(map[string]interface{})
			if err := rows.MapScan(dataMap); err != nil {
				fmt.Println(err)
				return err
			}

			instance := l.GetNewInstance()
			pkey := getPrimaryKeyForObj(instance)

			// for now we assume always uuid, not always gonna work
			idStr, err := cast.ToUUIDString(dataMap[pkey])
			if err != nil {
				fmt.Println(err)
				return err
			}
			key := l.GetCacheKeyForID(idStr)
			// set in cache
			setSingleCachedItem(key, dataMap, nil)

			if err := fillEntityFromMap(instance, dataMap); err != nil {
				fmt.Println(err)
				return err
			}
		}
		return nil
	}
}
