package ent

import (
	"regexp"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/lolopinto/ent/ent/cast"
	"github.com/lolopinto/ent/ent/sql"
	"github.com/lolopinto/ent/ent/viewer"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type testUser2 struct {
	Node
	EmailAddress string
	FirstName    string
	LastName     string
	Viewer       viewer.ViewerContext
}

/// TODO we want created_at and updated_at here at some point since that'll be automatically generated actually
func (user *testUser2) DBFields() DBFields {
	return DBFields{
		"id": func(v interface{}) error {
			var err error
			user.ID, err = cast.ToUUIDString(v)
			return err
		},
		"email_address": func(v interface{}) error {
			var err error
			user.EmailAddress, err = cast.ToString(v)
			return err
		},
		"first_name": func(v interface{}) error {
			var err error
			user.FirstName, err = cast.ToString(v)
			return err
		},
		"last_name": func(v interface{}) error {
			var err error
			user.LastName, err = cast.ToString(v)
			return err
		},
	}
}

type sqlTestCase struct {
	s              *sqlBuilder
	expectedQuery  string
	expectedValues []interface{}
}

func TestSelectBuilder(t *testing.T) {
	limit := 5
	var testCases = map[string]sqlTestCase{
		"string select": {
			&sqlBuilder{
				entity:    &testUser2{},
				tableName: "users",
				clause:    sql.Eq("id", "1"),
			},
			"SELECT id, email_address, first_name, last_name FROM users WHERE id = $1",
			[]interface{}{
				"1",
			},
		},
		"int select": {
			&sqlBuilder{
				colsString: "id, foo, bar",
				tableName:  "objects",
				clause:     sql.Eq("foo", 1),
			},
			"SELECT id, foo, bar FROM objects WHERE foo = $1",
			[]interface{}{
				1,
			},
		},
		"and clause": {
			&sqlBuilder{
				colsString: "id, foo, bar",
				tableName:  "objects",
				clause:     sql.And(sql.Eq("foo", 1), sql.Eq("bar", "ola@ola.com")),
			},
			"SELECT id, foo, bar FROM objects WHERE foo = $1 AND bar = $2",
			[]interface{}{
				1,
				"ola@ola.com",
			},
		},
		"triple and clause": {
			&sqlBuilder{
				colsString: "id, foo, bar",
				tableName:  "objects",
				clause:     sql.And(sql.Eq("foo", 1), sql.Eq("bar", "ola@ola.com"), sql.Eq("baz", "whelp")),
			},
			"SELECT id, foo, bar FROM objects WHERE foo = $1 AND bar = $2 AND baz = $3",
			[]interface{}{
				1,
				"ola@ola.com",
				"whelp",
			},
		},
		"and with order": {
			&sqlBuilder{
				colsString: "*",
				tableName:  "objects",
				clause:     sql.And(sql.Eq("foo", 1), sql.Eq("bar", "ola@ola.com")),
				order:      "time DESC",
			},
			"SELECT * FROM objects WHERE foo = $1 AND bar = $2 ORDER BY time DESC",
			[]interface{}{
				1,
				"ola@ola.com",
			},
		},
		"rawQuery": {
			&sqlBuilder{
				rawQuery: "SELECT * FROM objects WHERE foo = $1 AND bar = $2",
				rawValues: []interface{}{
					1,
					"ola@ola.com",
				},
			},
			"SELECT * FROM objects WHERE foo = $1 AND bar = $2",
			[]interface{}{
				1,
				"ola@ola.com",
			},
		},
		"in query": {
			&sqlBuilder{
				colsString: "id, foo, bar",
				tableName:  "objects",
				clause:     sql.In("id", "1", "2", "3"),
			},
			"SELECT id, foo, bar FROM objects WHERE id IN (?, ?, ?)",
			[]interface{}{
				"1",
				"2",
				"3",
			},
		},
		"limit": {
			&sqlBuilder{
				colsString: "id, foo, bar",
				tableName:  "objects",
				clause:     sql.Eq("id", "7"),
				limit:      &limit,
			},
			"SELECT id, foo, bar FROM objects WHERE id = %s LIMIT %s",
			[]interface{}{
				"7",
			},
		},
	}

	// map returned by DBFields is not deterministic so we need this to check that even if the columns aren't in the exact same order, the expected columns are retrieved
	testBuilder(
		t,
		testCases,
		colsFromRegex(regexp.MustCompile(`SELECT (.+) FROM`)),
		nil,
	)
}

func TestInsertBuilder(t *testing.T) {
	now := time.Now().UTC()
	var testCases = map[string]sqlTestCase{
		"insert return values": {
			getInsertQuery(
				"users",
				map[string]interface{}{
					"id":            "45",
					"email_address": "test@email.com",
					"first_name":    "Jon",
				},
				"RETURNING *",
			),
			"INSERT INTO users (id, email_address, first_name) VALUES(?, ?, ?) RETURNING *",
			[]interface{}{
				"45",
				"test@email.com",
				"Jon",
			},
		},
		"upsert conflict": {
			getInsertQuery(
				"edge_table",
				map[string]interface{}{
					"id1":       "45",
					"id2":       "54",
					"id1_type":  "user",
					"id2_type":  "user",
					"edge_type": "edge",
					"time":      now,
				},
				"ON CONFLICT(id1, edge_type, id2) DO UPDATE SET data = EXCLUDED.data",
			),
			"INSERT INTO edge_table (id1, id2, id1_type, id2_type, edge_type, time) VALUES(?, ?, ?, ?, ?, ?) ON CONFLICT(id1, edge_type, id2) DO UPDATE SET data = EXCLUDED.data",
			[]interface{}{
				"45",
				"54",
				"user",
				"user",
				"edge",
				now,
			},
		},
	}

	testBuilder(
		t,
		testCases,
		colsFromRegex(regexp.MustCompile(`INSERT INTO \w+ \((.+)\) VALUES`)),
		testEdiValues,
	)
}

func TestUpdateBuilder(t *testing.T) {
	user := &testUser2{}
	user.ID = "45"

	var testCases = map[string]sqlTestCase{
		"update": {
			getUpdateQuery("users", user, map[string]interface{}{
				"email_address": "test@email.com",
				"first_name":    "Jon",
			}),
			"UPDATE users SET email_address = ?, first_name = ? WHERE id = 45 RETURNING *",
			[]interface{}{
				"test@email.com",
				"Jon",
			},
		},
	}

	r := regexp.MustCompile(`UPDATE \w+ SET (.+) WHERE`)

	testBuilder(
		t,
		testCases,
		colsFromUpdateRegex(r),
		testEdiValues,
	)
}

func TestDeleteBuilder(t *testing.T) {
	user := &testUser2{}
	user.ID = "45"

	var testCases = map[string]sqlTestCase{
		"delete": {
			getDeleteQuery("users", sql.Eq("id", "45")),
			"DELETE FROM users WHERE id = ?",
			[]interface{}{
				"45",
			},
		},
		"delete multiple params": {
			getDeleteQuery(
				"edge_table",
				sql.And(
					sql.Eq("id1", "45"),
					sql.Eq("edge_type", "edge"),
					sql.Eq("id2", "54"),
				),
			),
			"DELETE FROM edge_table WHERE id1 = ? AND edge_type = ? AND id2 = ?",
			[]interface{}{
				"45",
				"edge",
				"54",
			},
		},
	}

	testBuilder(
		t,
		testCases,
		func(t *testing.T, actualQuery string, tt *sqlTestCase) ([]string, []string) {
			return []string{}, []string{}
		},
		nil,
	)
}

func testEdiValues(t *testing.T, tt *sqlTestCase, expectedCols, actualCols []string, actualValues []interface{}) {
	// keep track of positions because we'll use that to check that the expectedValues are in the order we expect
	// based on this
	// since we end up using maps which aren't stable, we need to do all this
	actualColPos := make(map[string]int)
	expectedColPos := make(map[string]int)
	for idx := 0; idx < len(expectedCols); idx++ {
		actualColPos[actualCols[idx]] = idx
		expectedColPos[expectedCols[idx]] = idx
	}

	for _, col := range actualCols {
		actualValPos := actualColPos[col]
		expectedValPos := expectedColPos[col]

		assert.Equal(
			t,
			tt.expectedValues[expectedValPos],
			actualValues[actualValPos],
			"value was not as expected, expected %v, got %v instead for col %s",
			tt.expectedValues[expectedValPos],
			actualValues[actualValPos],
			col,
		)
	}
}

func testBuilder(
	t *testing.T,
	testCases map[string]sqlTestCase,
	colsFromQuery func(*testing.T, string, *sqlTestCase) ([]string, []string),
	testFn func(*testing.T, *sqlTestCase, []string, []string, []interface{})) {

	for key, tt := range testCases {
		t.Run(key, func(t *testing.T) {
			actualQuery, actualValues, err := tt.s.Build()
			require.NoError(t, err)

			var origActualCols, origExpectedCols []string

			if actualQuery != tt.expectedQuery {
				actualCols, expectedCols := colsFromQuery(t, actualQuery, &tt)

				origActualCols = make([]string, len(actualCols))
				copy(origActualCols, actualCols)
				origExpectedCols = make([]string, len(expectedCols))
				copy(origExpectedCols, expectedCols)

				sort.Strings(actualCols)
				sort.Strings(expectedCols)

				assert.Equal(
					t,
					actualCols,
					expectedCols,
					"query was not as expected, expected %s, got %s instead",
					tt.expectedQuery,
					actualQuery,
				)
			}

			require.Len(t, actualValues, len(tt.expectedValues), "length of slice was not as expected")

			if testFn == nil || len(origActualCols) == 0 {
				for idx, actualValue := range actualValues {
					require.Equal(t, tt.expectedValues[idx], actualValue, "value was not as expected, expected %v, got %v instead", tt.expectedValues[idx], actualValue)
				}
			} else {
				testFn(t, &tt, origExpectedCols, origActualCols, actualValues)
			}
		})
	}
}

func colsFromRegex(r *regexp.Regexp) func(*testing.T, string, *sqlTestCase) ([]string, []string) {
	return func(t *testing.T, actualQuery string, tt *sqlTestCase) ([]string, []string) {
		actualMatch := r.FindStringSubmatch(actualQuery)
		expectedMatch := r.FindStringSubmatch(tt.expectedQuery)
		require.Len(t, actualMatch, 2, "expected match to have length of 2")
		require.Len(t, actualMatch, len(expectedMatch), "regex query was not as expected")

		actualCols := strings.Split(actualMatch[1], ", ")
		expectedCols := strings.Split(expectedMatch[1], ", ")
		return actualCols, expectedCols
	}
}

func colsFromUpdateRegex(r *regexp.Regexp) func(*testing.T, string, *sqlTestCase) ([]string, []string) {
	return func(t *testing.T, actualQuery string, tt *sqlTestCase) ([]string, []string) {
		actualMatch := r.FindStringSubmatch(actualQuery)
		expectedMatch := r.FindStringSubmatch(tt.expectedQuery)
		require.Len(t, actualMatch, 2, "expected match to have length of 2")
		require.Len(t, actualMatch, len(expectedMatch), "regex query was not as expected")

		actualCols := strings.Split(actualMatch[1], ", ")
		expectedCols := strings.Split(expectedMatch[1], ", ")
		for idx, col := range actualCols {
			parts := strings.Split(col, "=")
			actualCols[idx] = strings.TrimSpace(parts[0])
		}
		for idx, col := range expectedCols {
			parts := strings.Split(col, "=")
			expectedCols[idx] = strings.TrimSpace(parts[0])
		}
		return actualCols, expectedCols
	}
}
