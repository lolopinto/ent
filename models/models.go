package models

import (
	"errors"
	"fmt"
	"reflect"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx/reflectx"
	"github.com/lolopinto/jarvis/data"
)

// todo deal with struct tags
// todo empty interface{}
type insertdata struct {
	columns []string
	values  []interface{}
}

func getFieldsAndValuesOfStruct(value reflect.Value, setIDField bool) insertdata {
	if value.Kind() == reflect.Ptr {
		value = value.Elem()
	}
	valueType := value.Type()

	//fmt.Println(value, valueType)

	fieldCount := value.NumField()
	// fields -1 for node + 3 for uuid, created_at, updated_at
	var columns []string
	var values []interface{}

	newUUID := uuid.New().String()
	// add id column and value
	columns = append(columns, "id")
	values = append(values, newUUID)

	// TODO could eventually set time fields
	// make this a flag indicating if new object being created
	if setIDField {
		fbn := value.FieldByName("ID")
		if fbn.IsValid() {
			fbn.Set(reflect.ValueOf(newUUID))
		}
	}

	// use sqlx here?
	for i := 0; i < fieldCount; i++ {
		field := value.Field(i)
		typeOfField := valueType.Field(i)

		if field.Kind() == reflect.Struct {
			continue
			// TODO figure this out eventually
			// can hardcode the other info for now
			// or just migrate to use pop
			//getFieldsAndValuesOfStruct(field)
		}
		//fmt.Println(field.Kind(), field.Type())

		var column string
		tag := typeOfField.Tag.Get("db")
		if tag != "" {
			column = tag
		} else {
			column = typeOfField.Name
		}

		columns = append(columns, column)
		values = append(values, field.Interface())
	}
	columns = append(columns, "created_at", "updated_at")
	values = append(values, time.Now(), time.Now())

	return insertdata{columns, values}
}

func getFieldsAndValues(obj interface{}, setIDField bool) insertdata {
	value := reflect.ValueOf(obj)
	return getFieldsAndValuesOfStruct(value, setIDField)
}

func getColumnsString(insertData insertdata) string {
	// remove the time pieces. can't scan into embedded objects
	columns := insertData.columns[:len(insertData.columns)-2]

	return strings.Join(columns, ",")
}

func loadNode(id string, entity interface{}, tableName string) error {
	if entity == nil {
		return errors.New("nil pointer passed to loadNode")
	}
	// ok, so now we need a way to map from struct to fields
	db, err := data.DBConn()
	if err != nil {
		fmt.Println("error connecting to db ", err)
		return err
	}

	defer db.Close()

	insertData := getFieldsAndValues(entity, false)
	colsString := getColumnsString(insertData)

	computedQuery := fmt.Sprintf("SELECT %s FROM %s WHERE id = $1", colsString, tableName)
	fmt.Println(computedQuery)

	stmt, err := db.Preparex(computedQuery)
	if err != nil {
		fmt.Println(err)
		return err
	}
	defer stmt.Close()

	err = stmt.QueryRowx(id).StructScan(entity)
	if err != nil {
		fmt.Println(err)
	}
	return err
}

// this borrows from/learns from scanAll in sqlx library
func loadNodes(id string, nodes interface{}, colName string, tableName string) error {
	db, err := data.DBConn()
	if err != nil {
		fmt.Println("error connecting to db ", err)
		return err
	}

	value := reflect.ValueOf(nodes)
	direct := reflect.Indirect(value)

	if value.Kind() != reflect.Ptr {
		return errors.New("must pass a pointer to loadNodes")
	}
	if value.IsNil() {
		return errors.New("nil pointer passed to loadNodes")
	}

	// get the slice from the pointer
	slice := reflectx.Deref(value.Type())
	if slice.Kind() != reflect.Slice {
		fmt.Println("sadness")
		return errors.New("sadness with error in loadNodes")
	}

	// get the base type from the slice
	base := reflectx.Deref(slice.Elem())
	// todo: confirm this is what I think it is
	fmt.Println(base)

	// get a zero value of this
	value = reflect.New(base)
	// really need to rename this haha
	insertData := getFieldsAndValuesOfStruct(value, false)
	colsString := getColumnsString(insertData)

	computedQuery := fmt.Sprintf("SELECT %s FROM %s WHERE %s = $1", colsString, tableName, colName)
	fmt.Println(computedQuery)

	defer db.Close()

	stmt, err := db.Preparex(computedQuery)
	if err != nil {
		fmt.Println(err)
		return err
	}
	defer stmt.Close()

	rows, err := stmt.Queryx(id)
	if err != nil {
		fmt.Println(err)
		return err
	}

	defer rows.Close()

	for rows.Next() {
		entity := reflect.New(base)
		err = rows.StructScan(entity.Interface())
		if err != nil {
			fmt.Println(err)
			break
		}
		// append each entity into "nodes" destination
		direct.Set(reflect.Append(direct, reflect.Indirect(entity)))
	}

	return nil
}

func createNode(entity interface{}, tableName string) error {
	if entity == nil {
		// same as loadNode in terms of handling this better
		panic("nil entity passed to loadNode")
	}
	insertdata := getFieldsAndValues(entity, true)

	colsString := strings.Join(insertdata.columns, ",")
	var vals []string
	for i := range insertdata.values {
		vals = append(vals, fmt.Sprintf("$%d", i+1))
	}
	valsString := strings.Join(vals, ",")

	computedQuery := fmt.Sprintf("INSERT INTO %s (%s) VALUES(%s)", tableName, colsString, valsString)
	fmt.Println(computedQuery)

	db, err := data.DBConn()
	if err != nil {
		fmt.Println("error connecting to db")
		return err
	}

	defer db.Close()

	stmt, err := db.Preparex(computedQuery)

	if err != nil {
		fmt.Println(err)
		return err
	}

	res, err := stmt.Exec(insertdata.values...)
	if err != nil {
		fmt.Println(err)
		return err
	}
	defer stmt.Close()

	rowCount, err := res.RowsAffected()

	if err != nil || rowCount == 0 {
		fmt.Println(err)
		return err
	}
	return nil
}
