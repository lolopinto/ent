package ent

import (
	"fmt"

	"github.com/lolopinto/ent/data"
	"github.com/pkg/errors"
)

type loader interface {
	GetSqlBuilder(entity dataEntity) *sqlBuilder
}

type cachedLoader interface {
	loader
	GetCacheKey() string
}

type validatedLoader interface {
	loader
	Validate() error
}

func loadData(l loader, entity dataEntity) error {
	if entity == nil {
		return errors.New("nil pointer passed to loadData")
	}

	// validate the loader
	validator, ok := l.(validatedLoader)
	if ok {
		if err := validator.Validate(); err != nil {
			return err
		}
	}

	builder := l.GetSqlBuilder(entity)
	query := builder.getQuery()
	fmt.Println(query)

	db := data.DBConn()
	if db == nil {
		err := errors.New("error getting a valid db connection")
		fmt.Println(err)
		return err
	}

	stmt, err := getStmtFromTx(nil, db, query)

	if err != nil {
		fmt.Println(err)
		return err
	}
	defer stmt.Close()

	err = stmt.QueryRowx(builder.getValues()...).StructScan(entity)
	if err != nil {
		fmt.Println(err)
	}
	return err
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

func (l *loadNodeFromPartsLoader) GetSqlBuilder(entity dataEntity) *sqlBuilder {
	// ok, so now we need a way to map from struct to fields
	insertData := getFieldsAndValues(entity, false)
	colsString := insertData.getColumnsString()

	return &sqlBuilder{
		colsString: colsString,
		tableName:  l.config.GetTableName(),
		parts:      l.parts,
	}
}
