package test_db

import (
	"fmt"
	"os"
	"strings"

	"github.com/jmoiron/sqlx"
	"github.com/lolopinto/ent/ent/config"
	"github.com/lolopinto/ent/ent/data"
	"github.com/lolopinto/ent/internal/util"
)

// modeled after ts/src/testutils/db/test_db.ts
type TestDB struct {
	Tables []Table
	rootDB *sqlx.DB
	dbName string
	db     *sqlx.DB
}

func (tdb *TestDB) BeforeAll() error {
	dbInfo := config.DBConfig{
		Dialect:  "postgres",
		Port:     5432,
		User:     os.Getenv("POSTGRES_USER"),
		Password: os.Getenv("POSTGRES_PASSWORD"),
		Host:     "localhost",
		SslMode:  "disable",
	}

	db, err := sqlx.Open("postgres", dbInfo.GetConnectionStr())
	if err != nil {
		return err
	}

	if err = db.Ping(); err != nil {
		return err
	}
	tdb.rootDB = db

	tdb.dbName, err = util.GenerateRandDBName()
	if err != nil {
		return err
	}
	_, err = db.Query(fmt.Sprintf("CREATE DATABASE %s", tdb.dbName))
	if err != nil {
		return err
	}

	dbInfo.Database = tdb.dbName

	privatedb, err := sqlx.Open("postgres", dbInfo.GetConnectionStr())
	if err != nil {
		return err
	}
	if err = db.Ping(); err != nil {
		return err
	}

	tdb.db = privatedb

	for _, t := range tdb.Tables {
		_, err := tdb.db.Query(t.Create())
		if err != nil {
			return err
		}
	}

	// make this used for all connections
	return data.ResetDB(tdb.db, &dbInfo)
}

func (tdb *TestDB) AfterAll() error {
	if err := tdb.db.Close(); err != nil {
		return err
	}

	// there seems to be a dangling connection so we need to do this before dropping db
	// not ideal but that's what works for now
	_, err := tdb.rootDB.Query(fmt.Sprintf("REVOKE CONNECT ON DATABASE %s FROM public", tdb.dbName))
	if err != nil {
		return err
	}

	stmt, err := tdb.rootDB.Preparex("SELECT pid, pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1")
	if err != nil {
		return err
	}
	_, err = stmt.Query(tdb.dbName)
	if err != nil {
		return err
	}
	_, err = tdb.rootDB.Query(fmt.Sprintf("DROP DATABASE %s", tdb.dbName))
	if err != nil {
		return err
	}

	return tdb.rootDB.Close()
}

type Table struct {
	Name    string
	Columns []Column
}

func (t *Table) Create() string {
	cols := make([]string, len(t.Columns))
	for idx, col := range t.Columns {
		parts := []string{col.Name(), col.DataType()}
		if !col.Nullable() {
			parts = append(parts, "NOT NULL")
		}
		if col.PrimaryKey() {
			parts = append(parts, "PRIMARY KEY")
		}

		cols[idx] = strings.Join(parts, " ")
	}
	return fmt.Sprintf("CREATE TABLE %s (\n %s)", t.Name, strings.Join(cols, ",\n"))
}

func (t *Table) Drop() string {
	return fmt.Sprintf("DROP TABLE %s", t.Name)
}

type Column interface {
	Name() string
	DataType() string
	Nullable() bool
	PrimaryKey() bool
}

type basecolumn struct {
	name       string
	datatype   string
	nullable   bool
	primaryKey bool
}

func (b *basecolumn) Name() string {
	return b.name
}

func (b *basecolumn) DataType() string {
	return b.datatype
}

func (b *basecolumn) Nullable() bool {
	return b.nullable
}

func (b *basecolumn) PrimaryKey() bool {
	return b.primaryKey
}

type Option func(*basecolumn)

func Nullable() Option {
	return func(b *basecolumn) {
		b.nullable = true
	}
}

func PrimaryKey() Option {
	return func(b *basecolumn) {
		b.primaryKey = true
	}
}

func newColumn(name, datatype string, opts ...Option) *basecolumn {
	b := &basecolumn{
		name:     name,
		datatype: datatype,
	}
	for _, o := range opts {
		o(b)
	}
	return b
}

func UUID(name string, opts ...Option) Column {
	return newColumn(name, "uuid", opts...)
}

func Text(name string, opts ...Option) Column {
	return newColumn(name, "text", opts...)
}

func Bool(name string, opts ...Option) Column {
	return newColumn(name, "boolean", opts...)
}
func Timestamp(name string, opts ...Option) Column {
	return newColumn(name, "timestamp without time zone", opts...)
}

func Timestamptz(name string, opts ...Option) Column {
	return newColumn(name, "timestamp with time zone", opts...)
}

func Time(name string, opts ...Option) Column {
	return newColumn(name, "time without time zone", opts...)
}

func Timetz(name string, opts ...Option) Column {
	return newColumn(name, "time with time zone", opts...)
}

func Date(name string, opts ...Option) Column {
	return newColumn(name, "date", opts...)
}
