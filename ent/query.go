package ent

import (
	"fmt"

	"github.com/jmoiron/sqlx"
	"github.com/lolopinto/ent/data"
	"github.com/pkg/errors"
)

type processRawData struct {
	singleRow func(row *sqlx.Row) error
	multiRows func(rows *sqlx.Rows) error
}

type dbQuery struct {
	cfg       *loaderConfig
	l         loader
	singleRow bool
}

func (q *dbQuery) StructScan(dest interface{}) error {
	return q.query(&processRawData{
		singleRow: func(row *sqlx.Row) error {
			return row.StructScan(dest)
		}})
}

func (q *dbQuery) MapScan(dataMap map[string]interface{}) error {
	return q.query(&processRawData{
		singleRow: func(row *sqlx.Row) error {
			return row.MapScan(dataMap)
		}})
}

func (q *dbQuery) StructScanRows(l multiRowLoader) error {
	return q.query(&processRawData{
		multiRows: structScanRows(l),
	})
}

func (q *dbQuery) QueryRows(l multiRowLoader) error {
	return q.query(&processRawData{
		multiRows: queryRows(l),
	})
}

func (q *dbQuery) MapScanRows() ([]map[string]interface{}, error) {
	var dataRows []map[string]interface{}

	err := q.query(&processRawData{
		multiRows: mapScanRows(&dataRows),
	})

	return dataRows, err
}

func (q *dbQuery) customProcessRows(fn func(*sqlx.Rows) error) error {
	return q.query(&processRawData{
		multiRows: fn,
	})
}

func (q *dbQuery) query(processor *processRawData) error {
	builder, err := q.l.GetSQLBuilder()
	if err != nil {
		return err
	}
	query := builder.getQuery()
	//fmt.Println(query)

	db := data.DBConn()
	if db == nil {
		err := errors.New("error getting a valid db connection")
		fmt.Println(query, err)
		return err
	}

	stmt, err := getStmtFromTx(q.cfg.tx, db, query)

	// rebind the query for the db
	query = db.Rebind(query)

	if err != nil {
		fmt.Println(query, err)
		return err
	}
	defer stmt.Close()

	if processor.singleRow != nil {
		err = q.processSingleRow(builder, stmt, processor.singleRow)
	} else if processor.multiRows != nil {
		err = q.processMultiRows(builder, stmt, processor.multiRows)
	} else {
		panic("invalid processor passed")
	}
	if err != nil {
		fmt.Println(query, err)
	}
	return err
}

func (q *dbQuery) processSingleRow(builder *sqlBuilder, stmt *sqlx.Stmt, processRow func(row *sqlx.Row) error) error {
	row := stmt.QueryRowx(builder.getValues()...)
	return processRow(row)
}

func (q *dbQuery) processMultiRows(builder *sqlBuilder, stmt *sqlx.Stmt, processRows func(rows *sqlx.Rows) error) error {
	rows, err := stmt.Queryx(builder.getValues()...)
	if err != nil {
		return err
	}
	defer rows.Close()
	if err := processRows(rows); err != nil {
		return err
	}
	if err := rows.Err(); err != nil {
		return err
	}
	return nil
}

type rowQueryer interface {
	MapScan(map[string]interface{}) error
	StructScan(dest interface{}) error
}

func mapScan(query rowQueryer) (map[string]interface{}, error) {
	dataMap := make(map[string]interface{})

	// query and scan into map. return data in format needed by cache function
	err := query.MapScan(dataMap)
	return dataMap, err
}

// This handles StructScan vs MapScan descisions that need to be made when querying a single row
// (that's not going to cache)
// at some point we should change this to handle data going into cache
func queryRow(query rowQueryer, entity DBObject) error {
	notScannable, ok := entity.(dataEntityNotScannable)

	if !(ok && notScannable.UnsupportedScan()) {
		return query.StructScan(entity)
	}

	dataMap, err := mapScan(query)
	if err != nil {
		fmt.Println(err)
		return err
	}
	return fillEntityFromMap(entity, dataMap)
}

func queryRowRetMap(query rowQueryer, entity DBObject) (map[string]interface{}, error) {
	dataMap, err := mapScan(query)
	if err != nil {
		fmt.Println(err)
		return nil, err
	}
	err = fillEntityFromMap(entity, dataMap)
	return dataMap, err
}

func mapScanRows(dataRows *[]map[string]interface{}) func(*sqlx.Rows) error {
	return func(rows *sqlx.Rows) error {
		for rows.Next() {
			dataMap := make(map[string]interface{})
			if err := rows.MapScan(dataMap); err != nil {
				fmt.Println(err)
				return err
			}
			*dataRows = append(*dataRows, dataMap)
		}
		return nil
	}
}

func structScanRows(l multiRowLoader) func(*sqlx.Rows) error {
	return func(rows *sqlx.Rows) error {
		for rows.Next() {
			instance := l.GetNewInstance()
			if err := rows.StructScan(instance); err != nil {
				fmt.Println(err)
				return err
			}
		}
		return nil
	}
}

// This handles structScan vs MapScan decisions that need to be made when querying multiple
// rows that are not going to cache
// see queryRow
func queryRows(l multiRowLoader) func(*sqlx.Rows) error {
	return func(rows *sqlx.Rows) error {
		for rows.Next() {
			instance := l.GetNewInstance()
			if err := queryRow(rows, instance); err != nil {
				fmt.Println(err)
				return err
			}
		}
		return nil
	}
}
