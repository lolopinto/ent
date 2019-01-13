package data

import (
	"fmt"

	"github.com/jmoiron/sqlx"
)

// all of this needs to be taken from a onfiguration file instead of hardcoded
const (
	host = "localhost"
	port = 5432
	user = "ola"
	//  password = ""
	dbname = "jarvis"
)

func DBConn() (db *sqlx.DB, err error) {
	//sqlx.StructScan
	psqlInfo := fmt.Sprintf("host=%s port=%d user=%s "+
		"dbname=%s sslmode=disable",
		host, port, user, dbname)

	return sqlx.Open("postgres", psqlInfo)
}
