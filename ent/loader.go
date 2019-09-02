package ent

import (
	"fmt"

	"github.com/jmoiron/sqlx"
	"github.com/lolopinto/ent/data"
	"github.com/pkg/errors"
)

type loader interface {
	GetSQLBuilder(entity dataEntity) *sqlBuilder
}

type cachedLoader interface {
	loader
	GetCacheKey() string
}

type validatedLoader interface {
	loader
	Validate() error
}

type dbQuery struct {
	cfg    *loaderConfig
	l      loader
	entity dataEntity
}

func (q *dbQuery) StructScan() error {
	return q.query(q.entity, func(row *sqlx.Row) error {
		return row.StructScan(q.entity)
	})
}

func (q *dbQuery) MapScan(dataMap map[string]interface{}) error {
	return q.query(q.entity, func(row *sqlx.Row) error {
		return row.MapScan(dataMap)
	})
}

func (q *dbQuery) query(entity dataEntity, processRow func(*sqlx.Row) error) error {
	builder := q.l.GetSQLBuilder(entity)
	query := builder.getQuery()
	fmt.Println(query)

	db := data.DBConn()
	if db == nil {
		err := errors.New("error getting a valid db connection")
		fmt.Println(err)
		return err
	}

	stmt, err := getStmtFromTx(q.cfg.tx, db, query)

	if err != nil {
		fmt.Println(err)
		return err
	}
	defer stmt.Close()

	row := stmt.QueryRowx(builder.getValues()...)
	err = processRow(row)
	if err != nil {
		fmt.Println(err)
	}
	return err
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

func loadData(l loader, entity dataEntity, options ...func(*loaderConfig)) error {
	if entity == nil {
		return errors.New("nil pointer passed to loadData")
	}

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
		cfg:    cfg,
		l:      l,
		entity: entity,
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
		return entity.FillFromMap(actual)
	}

	return q.StructScan()
}

// TODO figure out if this is the right long term API
type loadNodeFromPartsLoader struct {
	config Config
	parts  []interface{}
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

func (l *loadNodeFromPartsLoader) GetSQLBuilder(entity dataEntity) *sqlBuilder {
	// ok, so now we need a way to map from struct to fields
	insertData := getFieldsAndValues(entity, false)
	colsString := insertData.getColumnsString()

	return &sqlBuilder{
		colsString: colsString,
		tableName:  l.config.GetTableName(),
		parts:      l.parts,
	}
}

type loadNodeFromPKey struct {
	id        string
	tableName string
}

func (l *loadNodeFromPKey) GetSQLBuilder(entity dataEntity) *sqlBuilder {
	// ok, so now we need a way to map from struct to fields
	// TODO while this is manual, cache this
	insertData := getFieldsAndValues(entity, false)
	colsString := insertData.getColumnsString()

	return &sqlBuilder{
		colsString: colsString,
		tableName:  l.tableName,
		parts: []interface{}{
			insertData.pkeyName,
			l.id,
		},
	}
}

func (l *loadNodeFromPKey) GetCacheKey() string {
	return getKeyForNode(l.id, l.tableName)
}
