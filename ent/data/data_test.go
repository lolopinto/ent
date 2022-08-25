package data_test

import (
	"os"
	"testing"

	"github.com/davecgh/go-spew/spew"
	"github.com/jmoiron/sqlx"
	_ "github.com/mattn/go-sqlite3"
	"github.com/stretchr/testify/assert"
)

func TestSQLite(t *testing.T) {
	defer os.Remove("foo.db")
	doTest(t, "foo.db")
}

func TestSQLiteMemory(t *testing.T) {
	doTest(t, ":memory:")
}

func doTest(t *testing.T, file string) {
	db, err := sqlx.Open("sqlite3", file)
	assert.NoError(t, err)

	err = db.Ping()

	assert.NoError(t, err)

	res, err := db.Exec("CREATE TABLE IF NOT EXISTS tbl (col INTEGER)")
	assert.NoError(t, err)
	spew.Dump(res.RowsAffected())

	res, err = db.Exec("INSERT INTO tbl VALUES(1)")
	assert.NoError(t, err)
	affected, err := res.RowsAffected()
	assert.NoError(t, err)
	assert.Equal(t, int64(1), affected)

	row := db.QueryRowx("SELECT * FROM tbl")
	g := make(map[string]interface{})

	err = row.MapScan(g)
	assert.NoError(t, err)
	assert.Equal(t, g["col"], int64(1))
}
