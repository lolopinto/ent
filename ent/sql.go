package ent

import (
	"fmt"
	"strings"

	"github.com/jmoiron/sqlx"
	"github.com/lolopinto/ent/ent/sql"
)

// first simple version of sql builder
type sqlBuilder struct {
	entity       DBObject
	fields       DBFields
	colsString   string // not long term value of course
	tableName    string
	clause       sql.QueryClause
	argsOverride []interface{}
	// keeping these so as to not kill existing use cases
	// TODO kill inField, inArgs
	inField   string
	inArgs    []interface{}
	order     string
	rawQuery  string
	rawValues []interface{}
	limit     *int
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

// This should be a Build()-> (string, []interface{}, error)
func (s *sqlBuilder) getQuery() string {
	if s.rawQuery != "" {
		return s.rawQuery
	}

	var whereClause string

	if s.clause != nil {
		whereClause = s.clause.GetClause()
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
	if s.limit != nil {
		formatSb.WriteString(" LIMIT {limit}")
		parts = append(parts, "{limit}", fmt.Sprintf("%d", *s.limit))
	}

	r := strings.NewReplacer(parts...)
	query := r.Replace(formatSb.String())

	// rebind for IN query using sqlx.In
	if s.clause != nil {
		inClause, ok := s.clause.(sql.InClause)
		if ok && inClause.RebindInClause() {
			var err error
			query, s.argsOverride, err = sqlx.In(query, s.clause.GetValues())
			if err != nil {
				// TODO make this return an error correctly
				panic(err)
			}
		}
	}
	return query
}

func (s *sqlBuilder) getValues() []interface{} {
	if len(s.argsOverride) != 0 {
		return s.argsOverride
	}
	// TODO validate that rawQuery and rawValues are passed together
	if len(s.rawValues) != 0 {
		return s.rawValues
	}

	if s.clause != nil {
		return s.clause.GetValues()
	}

	return nil
}
