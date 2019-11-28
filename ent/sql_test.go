package ent

import (
	"regexp"
	"sort"
	"strings"
	"testing"

	"github.com/lolopinto/ent/ent/cast"
	"github.com/lolopinto/ent/ent/viewer"
	"github.com/stretchr/testify/assert"
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

func TestSQLBuilder(t *testing.T) {
	limit := 5
	var testCases = []struct {
		s              *sqlBuilder
		expectedQuery  string
		expectedValues []interface{}
	}{
		{
			&sqlBuilder{
				entity:    &testUser2{},
				tableName: "users",
				whereParts: []interface{}{
					"id",
					"1",
				},
			},
			"SELECT id, email_address, first_name, last_name FROM users WHERE id = $1",
			[]interface{}{
				"1",
			},
		},
		{
			&sqlBuilder{
				colsString: "id, foo, bar",
				tableName:  "objects",
				whereParts: []interface{}{
					"foo",
					1,
				},
			},
			"SELECT id, foo, bar FROM objects WHERE foo = $1",
			[]interface{}{
				1,
			},
		},
		{
			&sqlBuilder{
				colsString: "id, foo, bar",
				tableName:  "objects",
				whereParts: []interface{}{
					"foo",
					1,
					"bar",
					"ola@ola.com",
				},
			},
			"SELECT id, foo, bar FROM objects WHERE foo = $1 AND bar = $2",
			[]interface{}{
				1,
				"ola@ola.com",
			},
		},
		{
			&sqlBuilder{
				colsString: "id, foo, bar",
				tableName:  "objects",
				whereParts: []interface{}{
					"foo",
					1,
					"bar",
					"ola@ola.com",
					"baz",
					"whelp",
				},
			},
			"SELECT id, foo, bar FROM objects WHERE foo = $1 AND bar = $2 AND baz = $3",
			[]interface{}{
				1,
				"ola@ola.com",
				"whelp",
			},
		},
		{
			&sqlBuilder{
				colsString: "*",
				tableName:  "objects",
				whereParts: []interface{}{
					"foo",
					1,
					"bar",
					"ola@ola.com",
				},
				order: "time DESC",
			},
			"SELECT * FROM objects WHERE foo = $1 AND bar = $2 ORDER BY time DESC",
			[]interface{}{
				1,
				"ola@ola.com",
			},
		},
		{
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
		{
			&sqlBuilder{
				colsString: "id, foo, bar",
				tableName:  "objects",
				inField:    "id",
				inArgs: []interface{}{
					"1",
					"2",
					"3",
				},
			},
			"SELECT id, foo, bar FROM objects WHERE id IN (?, ?, ?)",
			[]interface{}{
				"1",
				"2",
				"3",
			},
		},
		{
			&sqlBuilder{
				colsString: "id, foo, bar",
				tableName:  "objects",
				whereParts: []interface{}{
					"id",
					"7",
				},
				limit: &limit,
			},
			"SELECT id, foo, bar FROM objects WHERE id = %s LIMIT %s",
			[]interface{}{
				"7",
			},
		},
	}

	for _, tt := range testCases {
		actualQuery := tt.s.getQuery()
		if actualQuery != tt.expectedQuery {
			// map returned by DbFields is not deterministic so we need this to check that even if the columns aren't in the exact same order, the expected columns are retrieved
			r := regexp.MustCompile(`SELECT (.+) FROM`)

			actualMatch := r.FindStringSubmatch(actualQuery)
			expectedMatch := r.FindStringSubmatch(tt.expectedQuery)
			if len(actualMatch) != len(expectedMatch) {
				t.Errorf("regex query was not as expected")
			}

			if len(actualMatch) != 2 {
				t.Errorf("expected match to have length of 2")
			}

			actualCols := strings.Split(actualMatch[1], ", ")
			sort.Strings(actualCols)
			expectedCols := strings.Split(expectedMatch[1], ", ")
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

		actualValues := tt.s.getValues()
		if len(actualValues) != len(tt.expectedValues) {
			t.Errorf("length of slice was not as expected")
		}
		for idx, actualValue := range actualValues {
			if actualValue != tt.expectedValues[idx] {
				t.Errorf("value was not as expected, expected %v, got %v instead", tt.expectedValues[idx], actualValue)
			}
		}
	}
}
