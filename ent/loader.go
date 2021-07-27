package ent

import (
	"fmt"

	"github.com/jmoiron/sqlx"
	"github.com/lolopinto/ent/ent/cast"
	"github.com/lolopinto/ent/ent/config"
	"github.com/lolopinto/ent/ent/sql"
	"github.com/lolopinto/ent/internal/util"
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

type processRawLoader interface {
	ProcessRaw(map[string]interface{}) error
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
				util.GoSchemaKill("errorQuery returned without specifying errors")
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
	util.GoSchemaKill("invalid loader passed")
	return nil
}

func chainLoaders(loaders []loader, options ...func(*loaderConfig)) error {
	///	length := len(loaders)
	var output interface{}

	for idx, l := range loaders {
		inputLoader, ok := l.(chainableInputLoader)

		if ok {
			if idx == 0 {
				util.GoSchemaKill("first loader cannot require an input")
			}

			if output == nil {
				util.GoSchemaKill("loader requires an input but no input to pass in")
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
		util.GoSchemaKill("ended with an output loader which didn't do anything with it")
	}
	return nil
}

func loadMultiRowData(l multiRowLoader, q *dbQuery) error {
	// 1 key -> N items e.g. edge
	key := getCacheKeyFromLoader(l)
	// cachekey and valid keys
	if key != "" {
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

	return q.QueryRows(l)
}

func fillEntityFromMap(entity DBObject, dataMap map[string]interface{}) error {
	fields := entity.DBFields()
	for k, v := range dataMap {
		fieldFunc, ok := fields[k]
		if !ok {
			return fmt.Errorf("field %s retrieved from database which has no func", k)
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

func getCacheKeyFromLoader(l loader) string {
	if !cacheEnabled {
		return ""
	}
	// loader supports a cache. check it out
	cacheable, ok := l.(cachedLoader)
	if ok {
		return cacheable.GetCacheKey()
	}
	return ""
}

func loadRowData(l singleRowLoader, q *dbQuery) error {
	if l.GetEntity() == nil {
		return errors.New("nil entity passed to loadData")
	}

	key := getCacheKeyFromLoader(l)
	// handle cache access with valid cache key
	if key != "" {
		fn := func() (map[string]interface{}, error) {
			return mapScan(q)
		}

		actual, err := getItemFromCacheMaybe(key, fn)
		if err != nil {
			return err
		}
		// if not in cache, return raw data
		// TODO in the only instance we have of a processRawLoader
		// this line is not needed...
		if err := fillEntityFromMap(l.GetEntity(), actual); err != nil {
			return err
		}
		processRaw, ok := l.(processRawLoader)
		if ok {
			return processRaw.ProcessRaw(actual)
		}
		return nil
	}

	processRaw, ok := l.(processRawLoader)
	if ok {
		dataMap, err := queryRowRetMap(q, l.GetEntity())
		if err != nil {
			return err
		}
		return processRaw.ProcessRaw(dataMap)
	}

	return queryRow(q, l.GetEntity())
}

func getPrimaryKeyForLoader(loader Loader) string {
	pkey := "id"
	loaderWithPkey, ok := loader.(LoaderWithDiffPrimaryKey)
	if ok {
		pkey = loaderWithPkey.GetPrimaryKey()
	}
	return pkey
}

type loadNodeLoader struct {
	id        string
	entLoader Loader
	rawData   bool
	clause    sql.QueryClause

	// private
	dataRow   map[string]interface{}
	pkey      string
	tableName string
	entity    DBObject
}

func (l *loadNodeLoader) Validate() error {
	if l.entLoader == nil {
		return errors.New("loader required")
	}
	if l.id == "" && l.clause == nil {
		return errors.New("id or clause required")
	}
	return nil
}

func (l *loadNodeLoader) Configure() configureQueryResult {
	l.pkey = getPrimaryKeyForLoader(l.entLoader)
	l.entity = l.entLoader.GetNewInstance()
	l.tableName = l.entLoader.GetConfig().GetTableName()

	return configureWith(continueQuery)
}

func (l *loadNodeLoader) ProcessRaw(dataRow map[string]interface{}) error {
	// right now this replaces. We can have thi also do
	if l.rawData {
		l.dataRow = dataRow
		l.entity = nil
	}
	return nil
}

func (l *loadNodeLoader) GetSQLBuilder() (*sqlBuilder, error) {
	builder := &sqlBuilder{
		entity:    l.entity,
		tableName: l.tableName,
	}

	if l.clause == nil {
		builder.clause = sql.Eq(l.pkey, l.id)
	} else {
		builder.clause = l.clause
	}
	return builder, nil
}

func (l *loadNodeLoader) GetEntity() DBObject {
	return l.entity
}

func (l *loadNodeLoader) GetCacheKey() string {
	if l.id == "" {
		return ""
	}
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
		clause:     sql.And(sql.Eq("id1", l.id), sql.Eq("edge_type", l.edgeType)),
		order:      "time DESC",
		limit:      l.cfg.limit,
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
	Exists bool   `db:"exists"`
	Name   string `db:"name"`
}

func (n *nodeExists) GetID() string {
	util.GoSchemaKill("whaa")
	return ""
}

func (n *nodeExists) DBFields() DBFields {
	util.GoSchemaKill("should never be called since not cacheable")
	return nil
}

type loadAssocEdgeConfigExists struct {
	n []*nodeExists
}

func (l *loadAssocEdgeConfigExists) GetSQLBuilder() (*sqlBuilder, error) {
	query := "SELECT to_regclass($1) IS NOT NULL as exists"
	if config.IsSQLiteDialect() {
		query = "SELECT name FROM sqlite_master WHERE type='table' AND name=$1"
	}

	return &sqlBuilder{
		rawQuery: query,
		rawValues: []interface{}{
			"assoc_edge_config",
		},
	}, nil
}

func (l *loadAssocEdgeConfigExists) GetNewInstance() DBObject {
	n := &nodeExists{}
	l.n = append(l.n, n)
	return n
}

func (l *loadAssocEdgeConfigExists) GetOutput() interface{} {
	// has an output that's not necessary passable. just indicates whether we should continue
	// so GetOutput has 2 different meanings. This should mean continue chaining vs input/output
	// maybe decouple this later?
	// 0 no row in sqlite
	if len(l.n) == 0 {
		return nil
	}
	n := l.n[0]
	// postgres, table exists
	if n.Exists {
		return n.Exists
	}
	// sqlite table exists
	if n.Name != "" {
		return true
	}
	return nil
}

type loadNodesLoader struct {
	clause sql.QueryClause
	// limit 1 should just use loadNodeLoader. one good reason is dbsql.ErrNoRows being returned when QueryRow() is called but nothing of the sort
	// for querying for multiple rows
	limit int
	// keeping ids as first class citizen here because of cache logic
	ids       []string
	pkey      string // field we're querying from when doing ids query
	rawQuery  string
	entLoader Loader
	dbobjects []DBObject
	queryIDs  []string // ids we're fetching from db
	rawData   bool     // flat that indicates we're fetching raw data and not going through
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

	if len(l.ids) == 0 && l.rawQuery == "" && l.clause == nil {
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
		builder.clause = sql.In(l.pkey, inArgs...)
	} else if l.clause != nil {
		builder.clause = l.clause
	} else if l.rawQuery != "" {
		builder.rawQuery = l.rawQuery
	} else {
		return nil, errors.New("shouldn't call GetSQLBuilder() if there are no ids or parts")
	}

	if l.limit != 0 {
		builder.limit = &l.limit
	}

	return builder, nil
}

func (l *loadNodesLoader) GetCacheKeyForID(id string) string {
	return getKeyForNode(id, l.entLoader.GetConfig().GetTableName())
}

func (l *loadNodesLoader) Configure() configureQueryResult {
	// not loading a bunch of ids which may have a cache and all that complex stuff. simplify
	if l.clause != nil || l.rawQuery != "" {
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
	l.pkey = getPrimaryKeyForLoader(l.entLoader)

	return configureWith(continueQuery)
}

func (l *loadNodesLoader) ProcessRows() func(rows *sqlx.Rows) error {
	// cache enabled and we have specific ids to query
	if cacheEnabled && len(l.queryIDs) != 0 {
		return l.queryRowsAndFillCache()
	}

	// rawData not going to cache
	if l.rawData {
		return mapScanRows(&l.dataRows)
	}

	// everything else. clause, not going to cache for example
	return queryRows(l)
}

func (l *loadNodesLoader) queryRowsAndFillCache() func(rows *sqlx.Rows) error {
	return func(rows *sqlx.Rows) error {
		for rows.Next() {
			dataMap := make(map[string]interface{})
			if err := rows.MapScan(dataMap); err != nil {
				fmt.Println(err)
				return err
			}

			// for now we assume always uuid, not always gonna work
			idStr, err := cast.ToUUIDString(dataMap[l.pkey])
			if err != nil {
				fmt.Println(err)
				return err
			}
			key := l.GetCacheKeyForID(idStr)
			// set in cache
			setSingleCachedItem(key, dataMap, nil)

			// querying raw data, we're done here...
			if l.rawData {
				l.dataRows = append(l.dataRows, dataMap)
				continue
			}

			instance := l.GetNewInstance()

			if err := fillEntityFromMap(instance, dataMap); err != nil {
				fmt.Println(err)
				return err
			}
		}
		return nil
	}
}
