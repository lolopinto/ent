package base

import (
	"fmt"
	"strings"

	"github.com/iancoleman/strcase"
	"github.com/lolopinto/ent/internal/schema/input"
)

// common things needed across edges/fields etc
// only allowed to import input
type FieldEdgeInfo struct {
	Schema      string
	EdgeName    string
	Name        string
	Polymorphic *PolymorphicOptions
}

type PolymorphicOptions struct {
	*input.PolymorphicOptions
	NodeTypeField string
	Unique        bool // is this a unique field vs say an indexed field
}

func NewFieldEdgeInfo(fieldName string, polymorphic *input.PolymorphicOptions, unique bool) (*FieldEdgeInfo, error) {
	var edgeName string
	if strings.HasSuffix(fieldName, "ID") {
		edgeName = strings.TrimSuffix(fieldName, "ID")
	} else if strings.HasSuffix(fieldName, "_id") {
		edgeName = strings.TrimSuffix(fieldName, "_id")
	} else {
		return nil, fmt.Errorf("invalid field name %s for polymorphic field", fieldName)
	}

	nodeTypeField := strcase.ToLowerCamel(edgeName + "Type")

	return &FieldEdgeInfo{
		EdgeName: edgeName,
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
