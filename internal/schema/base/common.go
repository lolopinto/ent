package base

import (
	"fmt"
	"strings"

	"github.com/iancoleman/strcase"
	"github.com/lolopinto/ent/internal/schema/change"
	"github.com/lolopinto/ent/internal/schema/input"
)

// common things needed across edges/fields etc
// only allowed to import input
type FieldEdgeInfo struct {
	Schema        string                  `json:"schema,omitempty"`
	InverseEdge   *input.InverseFieldEdge `json:"inverseEdge,omitempty"`
	Polymorphic   *PolymorphicOptions     `json:"polymorphic,omitempty"`
	IndexEdge     *input.IndexEdgeOptions `json:"indexEdge,omitempty"`
	EdgeConstName string                  `json:"edgeConstName,omitempty"`
}

func (f *FieldEdgeInfo) EdgeName() string {
	if f.InverseEdge == nil {
		return ""
	}
	return f.InverseEdge.Name
}

func (f *FieldEdgeInfo) GetEdgeConstName() string {
	if f.EdgeConstName != "" {
		return f.EdgeConstName
	}
	poly := f.Polymorphic
	if poly != nil {
		return poly.EdgeConstName
	}
	return ""
}

func FieldEdgeInfoEqual(existing, edge *FieldEdgeInfo) bool {
	ret := change.CompareNilVals(existing == nil, edge == nil)
	if ret != nil {
		return *ret
	}

	return existing.Schema == edge.Schema &&
		input.InverseFieldEdgeEqual(existing.InverseEdge, edge.InverseEdge) &&
		PolymorphicOptionsEqual(existing.Polymorphic, edge.Polymorphic)
}

type PolymorphicOptions struct {
	*input.PolymorphicOptions
	NodeTypeField string `json:"nodeTypeField,omitempty"`
	// is this a unique field vs say an indexed field
	Unique bool `json:"unique,omitempty"`
}

func PolymorphicOptionsEqual(existing, p *PolymorphicOptions) bool {
	ret := change.CompareNilVals(existing == nil, p == nil)
	if ret != nil {
		return *ret
	}
	return input.PolymorphicOptionsEqual(existing.PolymorphicOptions, p.PolymorphicOptions) &&
		existing.NodeTypeField == p.NodeTypeField &&
		existing.Unique == p.Unique
}

func NewFieldEdgeInfo(fieldName string, polymorphic *input.PolymorphicOptions, unique bool) (*FieldEdgeInfo, error) {
	// var edgeName string

	edgeName, valid := TranslateIDSuffix(fieldName)
	if !valid {
		return nil, fmt.Errorf("invalid field name %s for polymorphic field", fieldName)
	}

	nodeTypeField := strcase.ToLowerCamel(edgeName + "Type")

	return &FieldEdgeInfo{
		InverseEdge: &input.InverseFieldEdge{
			Name: edgeName,
		},
		Polymorphic: &PolymorphicOptions{
			polymorphic,
			nodeTypeField,
			unique,
		},
	}, nil
}

// returns name such as tableName or file name
func GetSnakeCaseName(s string) string {
	// order of operations matters here
	// PickupLocation -> pickup_location
	return strings.ToLower(strcase.ToSnake(s))
}

func GetCamelName(s string) string {
	return strcase.ToCamel(s)
}

func GetNameFromParts(nameParts []string) string {
	return strings.Join(nameParts, "_")
}

func getNameFromParts2(prefix string, parts []string, suffix string) string {
	allParts := []string{prefix}
	allParts = append(allParts, parts...)
	allParts = append(allParts, suffix)
	return GetNameFromParts(allParts)
}

// generate a name for the foreignkey of the sort contacts_user_id_fkey.
// It takes the table name, the name of the column that references a foreign column in a foreign table and the fkey keyword to generate
// this only applies for single column fkeys
func GetFKeyName(tableName string, dbColNames ...string) string {
	return getNameFromParts2(tableName, dbColNames, "fkey")
}

func GetPrimaryKeyName(tableName string, dbColNames ...string) string {
	return getNameFromParts2(tableName, dbColNames, "pkey")
}

func GetUniqueKeyName(tableName string, dbColNames ...string) string {
	allParts := []string{tableName, "unique"}
	allParts = append(allParts, dbColNames...)
	return GetNameFromParts(allParts)
}

func TranslateIDSuffix(fieldName string) (string, bool) {
	// TODO https://github.com/lolopinto/ent/issues/674
	// TODO in GetFieldEdge in edge.go
	if strings.HasSuffix(fieldName, "ID") {
		return strings.TrimSuffix(fieldName, "ID"), true
	} else if strings.HasSuffix(fieldName, "_id") {
		return strings.TrimSuffix(fieldName, "_id"), true
	} else if strings.HasSuffix(fieldName, "Id") {
		return strings.TrimSuffix(fieldName, "Id"), true
	}
	return fieldName, false
}
