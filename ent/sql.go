package ent

import (
	"fmt"
	"strings"

	"github.com/jmoiron/sqlx"
)

// first simple version of sql builder
type sqlBuilder struct {
	entity     dataEntity
	fields     DBFields
	colsString string // not long term value of course
	tableName  string
	whereParts []interface{}
	inField    string
	inArgs     []interface{}
	order      string
	rawQuery   string
	rawValues  []interface{}
}

func (s *sqlBuilder) in(field string, args []interface{}) *sqlBuilder {
	s.inField = field
	s.inArgs = args
	return s
}

func (s *sqlBuilder) orderBy(orderBy string) *sqlBuilder {
	s.order = orderBy
	return s
}

func (s *sqlBuilder) getColsString() string {
	if s.colsString != "" {
		return s.colsString
	}

	var fields DBFields
	if s.fields != nil {
		fields = s.fields
	} else if s.entity != nil {
		fields = s.entity.DBFields()
	} else {
		return "*" // todo good default???
	}

	columns := make([]string, len(fields))
	idx := 0
	for k := range fields {
		columns[idx] = k
		idx++
	}
	return strings.Join(columns, ", ")
}

func (s *sqlBuilder) getQuery() string {
	if s.rawQuery != "" {
		return s.rawQuery
	}

	var whereClause string

	if len(s.whereParts) != 0 {
		var whereParts []string
		pos := 1
		for idx, val := range s.whereParts {
			if idx%2 == 1 {
				continue
			}
			whereParts = append(whereParts, fmt.Sprintf("%s = $%d", val, pos))
			pos++
		}
		whereClause = strings.Join(whereParts, " AND ")
	} else if s.inField != "" {
		whereClause = fmt.Sprintf("%s IN (?)", s.inField)
	}

	var formatSb strings.Builder

	formatSb.WriteString("SELECT {cols} FROM {table}")

	parts := []string{
		"{cols}", s.getColsString(),
		"{table}", s.tableName,
	}
	if whereClause != "" {
		formatSb.WriteString(" WHERE {where}")
		parts = append(parts, "{where}", whereClause)
	}
	if s.order != "" {
		formatSb.WriteString(" ORDER BY {order}")
		parts = append(parts, "{order}", s.order)
	}

	r := strings.NewReplacer(parts...)
	query := r.Replace(formatSb.String())

	// rebind for IN query using sqlx.In
	if len(s.inArgs) != 0 {
		var err error
		query, s.inArgs, err = sqlx.In(query, s.inArgs)
		if err != nil {
			// TODO make this return an error correctly
			panic(err)
		}
	}
	return query
}

func (s *sqlBuilder) getValues() []interface{} {
	// TODO validate that rawQuery and rawValues are passed together
	if len(s.rawValues) != 0 {
		return s.rawValues
	}
	// IN query
	if len(s.inArgs) != 0 {
		return s.inArgs
	}

	var ret []interface{}
	for idx, val := range s.whereParts {
		if idx%2 == 0 {
			continue
		}
		ret = append(ret, val)
	}
	return ret
}
