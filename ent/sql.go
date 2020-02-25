package ent

import (
	"fmt"
	"strings"

	"github.com/jmoiron/sqlx"
	"github.com/lolopinto/ent/ent/sql"
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
	argsOverride []interface{}
	// keeping these so as to not kill existing use cases
	// TODO kill inField, inArgs
	inField      string
	inArgs       []interface{}
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

	switch s.queryType {
	case selectQuery:
		return s.getSelectQuery()
	case insertQuery:
		return s.getInsertQuery()
	case updateQuery:
		return s.getUpdateQuery()
	case deleteQuery:
		return s.getDeleteQuery()
	}
	panic("unsupported query")
}

func (s *sqlBuilder) getInsertQuery() string {
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

	// to be returned by getValues()
	s.argsOverride = vals

	return fmt.Sprintf(
		"INSERT INTO %s (%s) VALUES(%s) %s",
		s.tableName,
		strings.Join(cols, ", "),
		strings.Join(valsString, ", "),
		s.insertSuffix,
	)
}

func (s *sqlBuilder) getUpdateQuery() string {
	vals := make([]interface{}, len(s.writeFields))
	valsString := make([]string, len(s.writeFields))

	idx := 0
	for k, v := range s.writeFields {
		vals[idx] = v
		valsString[idx] = fmt.Sprintf("%s = ?", k)
		idx++
	}

	// to be returned by getValues()
	s.argsOverride = vals

	return fmt.Sprintf(
		"UPDATE %s SET %s WHERE %s = '%s' RETURNING *",
		s.tableName,
		strings.Join(valsString, ", "),
		getPrimaryKeyForObj(s.existingEnt),
		s.existingEnt.GetID(),
	)
}

func (s *sqlBuilder) getDeleteQuery() string {
	// to be returned by getValues()
	s.argsOverride = s.clause.GetValues()

	return fmt.Sprintf(
		"DELETE from %s WHERE %s",
		s.tableName,
		s.clause.GetClause(),
	)
}

func (s *sqlBuilder) getSelectQuery() string {
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

func getPrimaryKeyForObj(entity DBObject) string {
	pKey := "id"
	entityWithPkey, ok := entity.(DBObjectWithDiffKey)
	if ok {
		pKey = entityWithPkey.GetPrimaryKey()
	}
	return pKey
}
