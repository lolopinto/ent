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
	SetInput(interface{})
}

type chainableOutputLoader interface {
	loader
	GetOutput() interface{} // should return nil to indicate not to call next loader
}

type multiRowLoader interface {
	loader
	// GetNewInstance returns a new instance of the item being read from the database
	// Two supported types:
	// 1 dataEntity
	// 2 reflect.Value in which underlying element is a dataEntity, specifically has a FillFromMap() method which can be called via reflection
	// when it's a reflect.Value(), StructScan() will be called with the underlying Interface() method
	// we want reflect.Value to know when to use reflection vs not
	// It's expected that the item is also appended to the internal slice which is used to keep track
	// of the items retrieved when returned.

	GetNewInstance() interface{}
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

	q := &dbQuery{
		cfg: cfg,
		l:   l,
		//		entity: entity,
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
			instance := l.GetNewInstance()
			entity, ok := instance.(dataEntity)
			if ok {
				entity.FillFromMap(actual[idx])
			} else {
				// todo handle reflect.Value later
				panic("invalid item returned from loader.GetNewInstance()")
			}
			//l.Append(instance)
		}
		return nil
	}
	return q.StructScanRows(l)
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
		return l.GetEntity().FillFromMap(actual)
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
	// ok, so now we need a way to map from struct to fields
	insertData := getFieldsAndValues(l.entity, false)
	colsString := insertData.getColumnsString()

	return &sqlBuilder{
		colsString: colsString,
		tableName:  l.config.GetTableName(),
		parts:      l.parts,
	}, nil
}

type loadNodeFromPKey struct {
	id        string
	tableName string
	entity    dataEntity
}

func (l *loadNodeFromPKey) GetSQLBuilder() (*sqlBuilder, error) {
	// ok, so now we need a way to map from struct to fields
	// TODO while this is manual, cache this
	insertData := getFieldsAndValues(l.entity, false)
	colsString := insertData.getColumnsString()

	return &sqlBuilder{
		colsString: colsString,
		tableName:  l.tableName,
		parts: []interface{}{
			insertData.pkeyName,
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
	id       string
	edgeType EdgeType
	edges    []*Edge
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
		parts: []interface{}{
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

func (l *loadEdgesByType) LoadData() ([]*Edge, error) {
	err := loadData(l)
	if err != nil {
		return nil, err
	}
	return l.edges, nil
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
