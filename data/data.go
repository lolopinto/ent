package data

import (
	"fmt"

	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq" //driver not used
	"github.com/lolopinto/ent/config"
)

var db *sqlx.DB

// init() initializes the database connection pool for use later
// init function called as package is initalized. Maybe make this explicit with InitDB()?
func init() {
	connStr := config.GetConnectionStr()
	var err error
	db, err = sqlx.Open("postgres", connStr)
	if err != nil {
		fmt.Println("error opening db", err)
		return
	}

	err = db.Ping()
	if err != nil {
		fmt.Println("DB unreachable", err)
	}
}

// GetSQLAlchemyDatabaseURIgo returns the databause uri needed by sqlalchemy to generate a schema file
func GetSQLAlchemyDatabaseURIgo() string {
	return config.Get().DB.GetSQLAlchemyDatabaseURIgo()
}

// DBConn returns a database connection pool to the DB for use
func DBConn() *sqlx.DB {
	return db
}

// CloseDB closes the database connection pool
func CloseDB() {
	if db != nil {
		db.Close()
	}
}
