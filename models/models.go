package models

import (
	"fmt"
	"reflect"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/lolopinto/jarvis/data"
)

// todo deal with struct tags
// todo empty interface{}
type insertdata struct {
	columns []string
	values  []interface{}
}

func getFieldsAndValuesOfStruct(value reflect.Value, setIDField bool) insertdata {
	valueType := value.Type()

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
	if value.Kind() == reflect.Ptr {
		value = value.Elem()
	}

	return getFieldsAndValuesOfStruct(value, setIDField)
}

func loadNode(id string, entity interface{}, tableName string) error {
	if entity == nil {
		// TODO handle this better later. maybe have custom error
		// return nil, err
		panic("nil entity passed to loadNode")
	}
	// ok, so now we need a way to map from struct to fields
	db, err := data.DBConn()
	if err != nil {
		fmt.Println("error connecting to db ", err)
		return err
	}

	defer db.Close()

	insertdata := getFieldsAndValues(entity, false)
	// remove the time pieces. can't scan into embedded objects
	columns := insertdata.columns[:len(insertdata.columns)-2]

	colsString := strings.Join(columns, ",")

	computedQuery := fmt.Sprintf("SELECT %s FROM %s WHERE id = $1", colsString, tableName)
	fmt.Println(computedQuery)

	stmt, err := db.Preparex(computedQuery)
	if err != nil {
		fmt.Println(err)
		return err
	}
	defer stmt.Close()

	// Update the entity we're loading so the call site has the right data
	// we can eventually codegen this so it's fine...
	switch v := entity.(type) {
	case *User:
		var user User
		err = stmt.Get(&user, id)
		*v = *(&user)
	case *Contact:
		var contact Contact
		err = stmt.Get(&contact, id)
		*v = *(&contact)
	default:
		panic(fmt.Sprint("unknown type for entity", entity))
	}
	if err != nil {
		fmt.Println(err)
	}
	return err
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
