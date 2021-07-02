package config_test

import (
	"os"
	"testing"

	"github.com/lolopinto/ent/ent/config"
	"github.com/stretchr/testify/assert"
)

func TestSQLite(t *testing.T) {
	connStr := "sqlite:///foo.db"
	os.Setenv("DB_CONNECTION_STRING", connStr)

	assert.Equal(t, config.GetConnectionStr(), connStr)
	db := config.Get().DB
	assert.Equal(t, "sqlite", db.Dialect)
	assert.Equal(t, "foo.db", db.FilePath)
	assert.Equal(t, "", db.Database)
	assert.Equal(t, "", db.User)
	assert.Equal(t, "", db.Password)
	assert.Equal(t, "", db.Host)
	assert.Equal(t, 0, db.Pool)
	assert.Equal(t, 0, db.Port)
	assert.Equal(t, "", db.SslMode)
	assert.Equal(t, connStr, db.GetConnectionStr())
	assert.Equal(t, connStr, db.GetSQLAlchemyDatabaseURIgo())

	os.Unsetenv("DB_CONNECTION_STRING")
}

func TestPostgres(t *testing.T) {
	// skipping because of env variable clashing
	t.Skip()
	connStr := "postgres://ola:@localhost/tsent_test"
	os.Setenv("DB_CONNECTION_STRING", connStr)

	expConnStr := connStr + "?sslmode=disable"
	assert.Equal(t, expConnStr, config.GetConnectionStr())

	db := config.Get().DB
	assert.Equal(t, "postgres", db.Dialect)
	assert.Equal(t, "", db.FilePath)
	assert.Equal(t, "tsent_test", db.Database)
	assert.Equal(t, "ola", db.User)
	assert.Equal(t, "", db.Password)
	assert.Equal(t, "localhost", db.Host)
	assert.Equal(t, 0, db.Pool)
	assert.Equal(t, 0, db.Port)
	assert.Equal(t, "disable", db.SslMode)
	assert.Equal(t, expConnStr, db.GetConnectionStr())
	assert.Equal(t, "postgresql+psycopg2://ola:@localhost/tsent_test", db.GetSQLAlchemyDatabaseURIgo())

	os.Unsetenv("DB_CONNECTION_STRING")
}
