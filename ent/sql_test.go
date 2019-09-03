package ent

import "testing"

func TestSQLBuilder(t *testing.T) {
	var testCases = []struct {
		s              *sqlBuilder
		expectedQuery  string
		expectedValues []interface{}
	}{
		{
			&sqlBuilder{
				colsString: "id, foo, bar",
				tableName:  "objects",
				parts: []interface{}{
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
				parts: []interface{}{
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
				parts: []interface{}{
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
				parts: []interface{}{
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
	}

	for _, tt := range testCases {
		actualQuery := tt.s.getQuery()
		if actualQuery != tt.expectedQuery {
			t.Errorf("query was not as expected, expected %s, got %s instead", tt.expectedQuery, actualQuery)
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
