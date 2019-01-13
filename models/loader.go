package models

import (
	"fmt"

	"github.com/jmoiron/sqlx"
	"github.com/lolopinto/jarvis/data"
)

// local to this package
type loadSingleNode func(db *sqlx.DB) (stmt *sqlx.Stmt, err error)

func loadNode(id string, entity interface{}, sqlQuery loadSingleNode) error {
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

	stmt, err := sqlQuery(db)
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
