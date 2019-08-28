package ent

import (
	"fmt"
	"strings"
)

// first simple version of sql builder
type sqlBuilder struct {
	colsString string // not long term value of course
	tableName  string
	parts      []interface{}
}

func (s *sqlBuilder) getQuery() string {
	var whereParts []string
	pos := 1
	for idx, val := range s.parts {
		if idx%2 == 1 {
			continue
		}
		whereParts = append(whereParts, fmt.Sprintf("%s = $%d", val, pos))
		pos++
	}

	return fmt.Sprintf(
		"SELECT %s FROM %s WHERE %s",
		s.colsString,
		s.tableName,
		strings.Join(whereParts, " AND "),
	)
}

func (s *sqlBuilder) getValues() []interface{} {
	var ret []interface{}
	for idx, val := range s.parts {
		if idx%2 == 0 {
			continue
		}
		ret = append(ret, val)
	}
	return ret
}
