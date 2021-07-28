package ent

import (
	"fmt"
	"strings"

	"github.com/jmoiron/sqlx"
	"github.com/lolopinto/ent/ent/sql"
	"github.com/lolopinto/ent/internal/util"
)

type queryType uint

const (
	selectQuery queryType = iota
	insertQuery
	updateQuery
	deleteQuery
)

// first simple version of sql builder
type sqlBuilder struct {
	entity       DBObject
	fields       DBFields
	colsString   string // not long term value of course
	tableName    string
	clause       sql.QueryClause
	order        string
	rawQuery     string
	rawValues    []interface{}
	limit        *int
	queryType    queryType
	writeFields  map[string]interface{}
	existingEnt  DBObject
	insertSuffix string
}

func getInsertQuery(tableName string, fields map[string]interface{}, insertSuffix string) *sqlBuilder {
	return &sqlBuilder{
		queryType:   insertQuery,
		tableName:   tableName,
		writeFields: fields,
		// TODO make this better support returningfields, upsert mode etc
		insertSuffix: insertSuffix,
	}
}

func getUpdateQuery(tableName string, existingEnt DBObject, fields map[string]interface{}) *sqlBuilder {
	return &sqlBuilder{
		queryType:   updateQuery,
		tableName:   tableName,
		writeFields: fields,
		existingEnt: existingEnt,
	}
}

func getDeleteQuery(tableName string, clause sql.QueryClause) *sqlBuilder {
	return &sqlBuilder{
		queryType: deleteQuery,
		tableName: tableName,
		clause:    clause,
	}
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

func (s *sqlBuilder) Build() (string, []interface{}, error) {
	if s.rawQuery != "" {
		return s.rawQuery, s.rawValues, nil
	}

	switch s.queryType {
	case selectQuery:
		return s.buildSelectQuery()
	case insertQuery:
		return s.buildInsertQuery()
	case updateQuery:
		return s.buildUpdateQuery()
	case deleteQuery:
		return s.buildDeleteQuery()
	}
	util.GoSchemaKill("unsupported query")
	return "", nil, nil
}

func (s *sqlBuilder) buildInsertQuery() (string, []interface{}, error) {
	cols := make([]string, len(s.writeFields))
	vals := make([]interface{}, len(s.writeFields))
	valsString := make([]string, len(s.writeFields))

	idx := 0
	for k, v := range s.writeFields {
		cols[idx] = k
		vals[idx] = v
		valsString[idx] = "?"
		idx++
	}

	query := fmt.Sprintf(
		"INSERT INTO %s (%s) VALUES(%s) %s",
		s.tableName,
		strings.Join(cols, ", "),
		strings.Join(valsString, ", "),
		s.insertSuffix,
	)
	return query, vals, nil
}

func (s *sqlBuilder) buildUpdateQuery() (string, []interface{}, error) {
	vals := make([]interface{}, len(s.writeFields))
	valsString := make([]string, len(s.writeFields))

	idx := 0
	for k, v := range s.writeFields {
		vals[idx] = v
		valsString[idx] = fmt.Sprintf("%s = ?", k)
		idx++
	}

	query := fmt.Sprintf(
		"UPDATE %s SET %s WHERE %s = '%s' RETURNING *",
		s.tableName,
		strings.Join(valsString, ", "),
		getPrimaryKeyForObj(s.existingEnt),
		s.existingEnt.GetID(),
	)
	return query, vals, nil
}

func (s *sqlBuilder) buildDeleteQuery() (string, []interface{}, error) {
	query := fmt.Sprintf(
		"DELETE from %s WHERE %s",
		s.tableName,
		s.clause.GetClause(),
	)
	return query, s.clause.GetValues(), nil
}

func (s *sqlBuilder) buildSelectQuery() (string, []interface{}, error) {
	var whereClause string

	var args []interface{}
	if s.clause != nil {
		whereClause = s.clause.GetClause()
		args = s.clause.GetValues()
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
			query, args, err = sqlx.In(query, s.clause.GetValues())
			if err != nil {
				return "", nil, err
			}
		}
	}
	return query, args, nil
}

func getPrimaryKeyForObj(entity DBObject) string {
	pKey := "id"
	entityWithPkey, ok := entity.(DBObjectWithDiffKey)
	if ok {
		pKey = entityWithPkey.GetPrimaryKey()
	}
	return pKey
}
