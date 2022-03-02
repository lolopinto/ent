package field

import (
	"github.com/lolopinto/ent/internal/edge"
	"github.com/lolopinto/ent/internal/enttype"
	"github.com/lolopinto/ent/internal/schema/base"
	"github.com/lolopinto/ent/internal/schema/change"
	"github.com/lolopinto/ent/internal/schema/input"
)

func CompareNonEntField(existing, field *NonEntField) []change.Change {
	var ret []change.Change
	if !NonEntFieldEqual(existing, field) {
		ret = append(ret, change.Change{
			Change: change.ModifyField,
		})
	}
	return ret
}

func NonEntFieldsEqual(existing, fields []*NonEntField) bool {
	if len(existing) != len(fields) {
		return false
	}
	for i := range existing {
		if !NonEntFieldEqual(existing[i], fields[i]) {
			return false
		}
	}
	return true
}

func NonEntFieldEqual(existing, field *NonEntField) bool {
	return existing.FieldName == field.FieldName &&
		compareType(existing.FieldType, field.FieldType) &&
		existing.nullable == field.nullable &&
		existing.Flag == field.Flag &&
		existing.NodeType == field.NodeType
}

func compareType(t1, t2 enttype.TSGraphQLType) bool {
	ret := change.CompareNilVals(t1 == nil, t2 == nil)
	if ret != nil {
		return *ret
	}
	// TODO some DB types panic...
	// does the minimum to compare types
	return t1.GetDBType() == t2.GetDBType() &&
		t1.GetGraphQLType() == t2.GetGraphQLType() &&
		t1.GetTSType() == t2.GetTSType()
}

func FieldEqual(existing, field *Field) bool {
	return existing.FieldName == field.FieldName &&
		// ignore entType, tagMap, pkgPath, dataTypePkgPath since all go specific
		existing.topLevelStructField == field.topLevelStructField &&
		compareType(existing.fieldType, field.fieldType) &&
		compareType(existing.graphqlFieldType, field.graphqlFieldType) &&
		existing.dbColumn == field.dbColumn &&
		existing.hideFromGraphQL == field.hideFromGraphQL &&
		existing.private == field.private &&
		input.PolymorphicOptionsEqual(existing.polymorphic, field.polymorphic) &&
		existing.nullable == field.nullable &&
		existing.graphqlNullable == field.graphqlNullable &&
		existing.defaultValue == field.defaultValue &&
		existing.unique == field.unique &&
		foreignKeyInfoEqual(existing.fkey, field.fkey) &&
		base.FieldEdgeInfoEqual(existing.fieldEdge, field.fieldEdge) &&
		existing.index == field.index &&
		existing.dbName == field.dbName &&
		existing.graphQLName == field.graphQLName &&
		existing.exposeToActionsByDefault == field.exposeToActionsByDefault &&
		existing.disableBuilderType == field.disableBuilderType &&
		existing.derivedWhenEmbedded == field.derivedWhenEmbedded &&
		existing.singleFieldPrimaryKey == field.singleFieldPrimaryKey &&
		edge.AssocEdgeEqual(existing.inverseEdge, field.inverseEdge) &&
		existing.disableUserEditable == field.disableUserEditable &&
		existing.hasDefaultValueOnCreate == field.hasDefaultValueOnCreate &&
		existing.hasDefaultValueOnEdit == field.hasDefaultValueOnEdit &&
		existing.forceRequiredInAction == field.forceRequiredInAction &&
		existing.forceOptionalInAction == field.forceOptionalInAction &&
		existing.patternName == field.patternName
}

func FieldsEqual(fields1, fields2 []*Field) bool {
	if len(fields1) != len(fields2) {
		return false
	}
	for i := range fields1 {
		if !FieldEqual(fields1[i], fields2[i]) {
			return false
		}
	}
	return true
}

func foreignKeyInfoEqual(existing, fkey *ForeignKeyInfo) bool {
	ret := change.CompareNilVals(existing == nil, fkey == nil)
	if ret != nil {
		return *ret
	}
	return existing.Schema == fkey.Schema &&
		existing.Field == fkey.Field &&
		existing.Name == fkey.Name &&
		existing.DisableIndex == fkey.DisableIndex
}

func compareFieldMap(m1, m2 map[string]*Field) []change.Change {
	var ret []change.Change
	for k, f1 := range m1 {
		f2, ok := m2[k]
		// in 1st but not 2nd, dropped
		if !ok {
			ret = append(ret, change.Change{
				Change: change.RemoveField,
				Field:  k,
			})
		} else {
			if !FieldEqual(f1, f2) {
				ret = append(ret, change.Change{
					Change: change.ModifyField,
					Field:  k,
				})
			}
		}
	}

	for k := range m2 {
		_, ok := m1[k]
		// in 2nd but not first, added
		if !ok {
			ret = append(ret, change.Change{
				Change: change.AddField,
				Field:  k,
			})
		}
	}
	return ret
}

func CompareFieldInfo(f1, f2 *FieldInfo) []change.Change {
	if f1 == nil {
		f1 = &FieldInfo{}
	}
	if f2 == nil {
		f2 = &FieldInfo{}
	}
	return compareFieldMap(f1.fieldMap, f2.fieldMap)
}
