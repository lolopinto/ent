package sql

import (
	"fmt"
	"strings"
)

// TODO
type QueryClause interface {
	GetClause() string
	GetValues() []interface{}
	//	GetKeys() []string // TODO need this??
}

type InClause interface {
	RebindInClause() bool
}

// TODO in clauses
type simpleQueryClause struct {
	col   string
	value interface{}
}

func (c *simpleQueryClause) GetClause() string {
	return fmt.Sprintf("%s = ?", c.col)
}

func (c *simpleQueryClause) GetValues() []interface{} {
	return []interface{}{
		c.value,
	}
}

func Eq(col string, value interface{}) *simpleQueryClause {
	return &simpleQueryClause{
		col:   col,
		value: value,
	}
}

func getClauseFromClauses(clauses []QueryClause, sep string) string {
	parts := make([]string, len(clauses))
	for idx, clause := range clauses {
		parts[idx] = clause.GetClause()
	}
	return strings.Join(parts, " AND ")
}

func getValuesFromClauses(clauses []QueryClause) []interface{} {
	var ret []interface{}
	for _, clause := range clauses {
		ret = append(ret, clause.GetValues()...)
	}
	return ret
}

type andQueryClause struct {
	clauses []QueryClause
}

func (c *andQueryClause) GetClause() string {
	return getClauseFromClauses(c.clauses, " AND ")
}

func (c *andQueryClause) GetValues() []interface{} {
	return getValuesFromClauses(c.clauses)
}

type orQueryClause struct {
	clauses []QueryClause
}

func (c *orQueryClause) GetClause() string {
	return getClauseFromClauses(c.clauses, " OR ")
}

func (c *orQueryClause) GetValues() []interface{} {
	return getValuesFromClauses(c.clauses)
}

type inClause struct {
	col  string
	vals []interface{}
}

func (c *inClause) GetClause() string {
	return fmt.Sprintf("%s IN (?)", c.col)
}

func (c *inClause) GetValues() []interface{} {
	return c.vals
}

func (c *inClause) RebindInClause() bool {
	return true
}

// TODO: change composite to support in...
func And(clauses ...QueryClause) *andQueryClause {
	return &andQueryClause{
		clauses: clauses,
	}
}

func Or(clauses ...QueryClause) *orQueryClause {
	return &orQueryClause{
		clauses: clauses,
	}
}

func In(col string, vals ...interface{}) *inClause {
	return &inClause{
		col:  col,
		vals: vals,
	}
}
