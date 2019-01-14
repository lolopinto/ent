package models

import (
	"fmt"
	"reflect"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"github.com/lolopinto/jarvis/data"
)

// todo deal with struct tags
// todo empty interface{}
type insertdata struct {
	columns []string
	values  []interface{}
	newUUID string
}

func getFieldsAndValuesOfStruct(value reflect.Value) insertdata {
	valueType := value.Type()

	fieldCount := value.NumField()
	// fields -1 for node + 3 for uuid, created_at, updated_at
	var columns []string
	var values []interface{}

	newUUID := uuid.New().String()
	// add id column and value
	columns = append(columns, "id")
	values = append(values, newUUID)

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

	return insertdata{columns, values, newUUID}
}

func getFieldsAndValues(obj interface{}) insertdata {
	value := reflect.ValueOf(obj)
	if value.Kind() == reflect.Ptr {
		value = value.Elem()
	}

	return getFieldsAndValuesOfStruct(value)
}

// local to this package
type loadSingleNode func(db *sqlx.DB) (stmt *sqlx.Stmt, err error)

func loadNode(id string, entity interface{}) error {
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

	insertdata := getFieldsAndValues(entity)
	// remove the time pieces. can't scan into embedded objects
	columns := insertdata.columns[:len(insertdata.columns)-2]

	colsString := strings.Join(columns, ",")

	// same as CREATE. name needs to be stored somewhere
	// tablename needs to be stored somewhere
	computedQuery := fmt.Sprintf("SELECT %s FROM %s WHERE id = $1", colsString, "users")
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
