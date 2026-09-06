package data

import (
	"log"
	"sync"

	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq" //driver not used
	"github.com/lolopinto/ent/ent/config"
	_ "github.com/mattn/go-sqlite3"
)

var db *sqlx.DB
var dbMutex sync.RWMutex

func initDB() error {
	if db != nil {
		return nil
	}

	cfg := config.Get()
	db2, err := cfg.DB.Init()
	if err != nil {
		return err
	}
	db = db2
	return nil
}

// InitDB initializes the database connection pool if it has not been initialized.
func InitDB() error {
	dbMutex.Lock()
	defer dbMutex.Unlock()
	return initDB()
}

// GetSQLAlchemyDatabaseURIgo returns the databause uri needed by sqlalchemy to generate a schema file
func GetSQLAlchemyDatabaseURIgo() string {
	return config.Get().DB.GetSQLAlchemyDatabaseURIgo()
}

// DBConn returns a database connection pool to the DB for use, initializing it
// on first access.
func DBConn() *sqlx.DB {
	dbMutex.Lock()
	defer dbMutex.Unlock()
	if err := initDB(); err != nil {
		log.Fatal(err)
	}
	return db
}

// CloseDB closes the database connection pool
func CloseDB() error {
	dbMutex.Lock()
	defer dbMutex.Unlock()

	if db != nil {
		err := db.Close()
		db = nil
		return err
	}
	return nil
}

// TODO this obviously needs to be cleaned up
// used by tests
func ResetDB(db2 *sqlx.DB, rdbi *config.DBConfig) error {
	dbMutex.Lock()
	defer dbMutex.Unlock()

	if db != nil {
		if err := db.Close(); err != nil {
			return err
		}
	}
	db = db2
	config.ResetConfig(rdbi)
	return nil
}
