package ent

import (
	"fmt"
	"reflect"

	"github.com/jmoiron/sqlx"
	"github.com/lolopinto/ent/data"
	"github.com/pkg/errors"
)

type processRawData struct {
	singleRow func(row *sqlx.Row) error
	multiRows func(rows *sqlx.Rows) error
}

type dbQuery struct {
	cfg *loaderConfig
	l   loader
	//	entity    dataEntity
	singleRow bool
}

func (q *dbQuery) StructScan(l singleRowLoader) error {
	return q.query(&processRawData{
		singleRow: func(row *sqlx.Row) error {
			return row.StructScan(l.GetEntity())
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
		multiRows: func(rows *sqlx.Rows) error {

			for rows.Next() {
				var err error
				instance := l.GetNewInstance()
				value, ok := instance.(reflect.Value)
				if ok {
					err = rows.StructScan(value.Interface())
				} else {
					// otherwise assume it implements Scan interface
					err = rows.StructScan(instance)
				}
				if err != nil {
					fmt.Println(err)
					return err
				}
				//				l.Append(instance)
			}
			return nil
		}})
}

func (q *dbQuery) MapScanRows() ([]map[string]interface{}, error) {
	var dataRows []map[string]interface{}

	err := q.query(&processRawData{
		multiRows: func(rows *sqlx.Rows) error {

			for rows.Next() {
				dataMap := make(map[string]interface{})
				err := rows.MapScan(dataMap)
				if err != nil {
					fmt.Println(err)
					return err
				}
				dataRows = append(dataRows, dataMap)
			}
			return nil
		}})

	return dataRows, err
}

func (q *dbQuery) query(processor *processRawData) error {
	//	processRow func(*sqlx.Row) error) error {
	builder, err := q.l.GetSQLBuilder()
	if err != nil {
		return err
	}
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

	if processor.singleRow != nil {
		err = q.processSingleRow(builder, stmt, processor.singleRow)
	} else if processor.multiRows != nil {
		err = q.processMultiRows(builder, stmt, processor.multiRows)
	} else {
		panic("invalid processor passed")
	}
	if err != nil {
		fmt.Println(err)
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
		fmt.Println(err)
		return err
	}
	defer rows.Close()
	err = processRows(rows)
	if err != nil {
		fmt.Println(err)
	}
	err = rows.Err()
	if err != nil {
		fmt.Println(err)
	}
	return err
}
