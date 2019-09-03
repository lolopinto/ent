package ent

import (
	"fmt"

	"github.com/jmoiron/sqlx"
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

type multiRowLoader interface {
	loader
	// TODO... this returns a new Edge etc
	GetNewInstance() dataEntity
	// this returns the slice. both of this hard because of go nonsense. TODO
	//GetNewSlice() dataEntity
	Append(entity dataEntity)
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
			instance.FillFromMap(actual[idx])
			l.Append(instance)
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
	edges    []Edge
}

func (l *loadEdgesByType) GetSQLBuilder() (*sqlBuilder, error) {
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

func (l *loadEdgesByType) GetNewInstance() dataEntity {
	var edge Edge
	return &edge
}

func (l *loadEdgesByType) Append(entity dataEntity) {
	edge, ok := entity.(*Edge)
	if !ok {
		panic("invalid type passed")
	}
	l.edges = append(l.edges, *edge)
}

func (l *loadEdgesByType) LoadData() ([]Edge, error) {
	err := loadData(l)
	if err != nil {
		return nil, err
	}
	return l.edges, nil
}
