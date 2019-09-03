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
	order      string
}

func (s *sqlBuilder) orderBy(orderBy string) *sqlBuilder {
	s.order = orderBy
	return s
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

	format := "SELECT {cols} FROM {table} WHERE {where}"
	parts := []string{
		"{cols}", s.colsString,
		"{table}", s.tableName,
		"{where}", strings.Join(whereParts, " AND "),
	}
	if s.order != "" {
		format = format + " ORDER BY {order}"
		parts = append(parts, "{order}", s.order)
	}

	r := strings.NewReplacer(parts...)
	return r.Replace(format)
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
