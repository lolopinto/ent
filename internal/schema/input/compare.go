package input

import (
	"github.com/lolopinto/ent/internal/enttype"
	"github.com/lolopinto/ent/internal/schema/change"
)

// TODO kill this file

type ChangeType string

const (
	AddPattern       ChangeType = "add_pattern"
	DropPattern      ChangeType = "drop_pattern"
	AddNode          ChangeType = "add_table"
	DropNode         ChangeType = "drop_table"
	AddField         ChangeType = "add_column"
	DropField        ChangeType = "drop_column"
	CreateIndex      ChangeType = "create_index"
	DropIndex        ChangeType = "drop_index"
	CreateForeignKey ChangeType = "create_foreign_key"
	// TODO...
	AlterField             ChangeType = "alter_field"
	CreateUniqueConstraint ChangeType = "create_unique_constraint"
	AddEdges               ChangeType = "add_edges"
	RemoveEdges            ChangeType = "remove_edges"
	ModifyEdge             ChangeType = "modify_edge"
	AddRows                ChangeType = "add_rows"
	RemoveRows             ChangeType = "remove_rows"
	ModifyRows             ChangeType = "modify_rows"
	AlterEnum              ChangeType = "alter_enum"
	AddEnum                ChangeType = "add_enum"
	DropEnum               ChangeType = "drop_enum"
	CreateCheckConstraint  ChangeType = "create_check_constraint"
	DropCheckConstraint    ChangeType = "drop_check_constraint"
)

type Change struct {
	Change      ChangeType
	Field       string
	GraphQLOnly bool
	TSOnly      bool
}

type ChangeMap map[string][]Change

func CompareSchemas(existing, schema *Schema) ChangeMap {
	m := make(ChangeMap)
	if existing == nil {
		// act like everything is new...
		for k := range schema.Patterns {
			m[k] = []Change{
				{
					Change: AddPattern,
				},
			}
		}
		for k := range schema.Nodes {
			m[k] = []Change{
				{
					Change: AddNode,
				},
			}
		}
		return m
	}

	for k := range existing.Patterns {
		existingPattern := existing.Patterns[k]
		p, ok := schema.Patterns[k]
		if !ok {
			m[k] = []Change{
				{
					Change: AddPattern,
				},
			}
		} else {
			changes := compareFields(existingPattern.Fields, p.Fields)

			// TODO compare edges and append
			m[k] = changes
		}
	}
	return m
}

func compareFields(existing, fields []*Field) []Change {
	var ret []Change
	existingFieldMap := make(map[string]*Field)
	fieldMap := make(map[string]*Field)
	for _, f := range existing {
		existingFieldMap[f.Name] = f
	}

	for _, f := range fields {
		fieldMap[f.Name] = f
	}

	for k, existingField := range existingFieldMap {
		field, ok := fieldMap[k]
		if !ok {
			ret = append(ret, Change{
				Change: DropField,
				Field:  existingField.Name,
			})
			continue
		}
		alterField := false

		// ignoring PrimaryKey
		if existingField.Nullable != field.Nullable ||
			existingField.StorageKey != field.StorageKey ||
			existingField.Unique != field.Unique ||
			existingField.Private != field.Private ||
			existingField.Index != field.Index ||
			existingField.DefaultToViewerOnCreate != field.DefaultToViewerOnCreate ||
			existingField.ServerDefault != field.ServerDefault ||
			existingField.DisableUserEditable != field.DisableUserEditable ||
			existingField.HasDefaultValueOnCreate != field.HasDefaultValueOnCreate ||
			existingField.HasDefaultValueOnEdit != field.HasDefaultValueOnEdit ||
			existingField.DerivedWhenEmbedded != field.DerivedWhenEmbedded ||
			existingField.PatternName != field.PatternName {
			alterField = true
			ret = append(ret, Change{
				Change: AlterField,
				Field:  existingField.Name,
			})
		}
		if existingField.HideFromGraphQL != field.HideFromGraphQL ||
			existingField.GraphQLName != field.GraphQLName {
			ret = append(ret, Change{
				Change:      AlterField,
				Field:       existingField.Name,
				GraphQLOnly: true,
			})
		}

		// check for complicated things
		// Polymorphic, DerivedFields
		funcs := []func() bool{
			func() bool {
				return fieldTypeEqual(existingField.Type, field.Type)
			},
			func() bool {
				return fieldEdgeEqual(existingField.FieldEdge, field.FieldEdge)
			},
			func() bool {
				return foreignKeyEqual(existingField.ForeignKey, field.ForeignKey)
			},
		}

		if !alterField {
			for _, fn := range funcs {
				ret := fn()
				if !ret {
					alterField = true
					break
				}
			}
		}
	}

	for k, field := range fieldMap {
		_, ok := existingFieldMap[k]
		if !ok {
			ret = append(ret, Change{
				Change: AddField,
				Field:  field.Name,
			})
		}
	}

	return ret
}

// return boolean if one is nil and the other is not nil or both nil
// if both not nil, returns nil, indicating more work to be done
// TODO kill
func compareEqual(existing, val interface{}) *bool {
	var ret *bool

	if xor(existing, val) {
		temp := false
		ret = &temp
	}
	if existing == nil && val == nil {
		temp := true
		ret = &temp
	}
	return ret
}

func compareNilVals(existingNil, valNil bool) *bool {
	var ret *bool

	if existingNil != valNil {
		temp := false
		ret = &temp
	}
	if existingNil && valNil {
		temp := true
		ret = &temp
	}
	return ret
}

func xor(existing, val interface{}) bool {
	return (existing == nil && val != nil) || (existing != nil && val == nil)
}

func stringListEqual(l1, l2 []string) bool {
	if len(l1) != len(l2) {
		return false
	}

	for k, v1 := range l1 {
		if l2[k] != v1 {
			return false
		}
	}
	return true
}

func stringMapEqual(m1, m2 map[string]string) bool {
	if len(m1) != len(m2) {
		return false
	}

	for k := range m1 {
		_, ok := m2[k]
		if !ok {
			return false
		}
	}

	for k := range m2 {
		_, ok := m1[k]
		if !ok {
			return false
		}
	}
	return true
}

func fieldTypeEqual(existing, fieldType *FieldType) bool {
	ret := compareEqual(existing, fieldType)
	if ret != nil {
		return *ret
	}

	return existing.DBType == fieldType.DBType &&
		fieldTypeEqual(existing.ListElemType, fieldType.ListElemType) &&
		stringListEqual(existing.Values, fieldType.Values) &&
		stringMapEqual(existing.EnumMap, fieldType.EnumMap) &&
		existing.Type == fieldType.Type &&
		existing.GraphQLType == fieldType.GraphQLType &&
		existing.CustomType == fieldType.CustomType &&
		importTypeEqual(existing.ImportType, fieldType.ImportType)
}

func importTypeEqual(existing, importType *enttype.InputImportType) bool {
	ret := compareEqual(existing, importType)
	if ret != nil {
		return *ret
	}

	return existing.Path == importType.Path && existing.Type == importType.Path
}

func fieldEdgeEqual(existing, fieldEdge *FieldEdge) bool {
	ret := compareEqual(existing, fieldEdge)
	if ret != nil {
		return *ret
	}

	return existing.Schema == fieldEdge.Schema &&
		existing.DisableBuilderType == fieldEdge.DisableBuilderType &&
		InverseFieldEdgeEqual(existing.InverseEdge, fieldEdge.InverseEdge)
}

func InverseFieldEdgeEqual(existing, inverseFieldEdge *InverseFieldEdge) bool {
	ret := compareNilVals(existing == nil, inverseFieldEdge == nil)

	if ret != nil {
		return *ret
	}

	// here is why we want derived field info instead of this...
	// HideFromGraphQL should alter only graphql
	return existing.Name == inverseFieldEdge.Name &&
		existing.TableName == inverseFieldEdge.TableName &&
		existing.HideFromGraphQL == inverseFieldEdge.HideFromGraphQL &&
		existing.EdgeConstName == inverseFieldEdge.EdgeConstName
}

func foreignKeyEqual(existing, fkey *ForeignKey) bool {
	return existing.Schema == fkey.Schema &&
		existing.Column == fkey.Column &&
		existing.Name == fkey.Name &&
		existing.DisableIndex == fkey.DisableIndex &&
		existing.DisableBuilderType && fkey.DisableBuilderType
}

func PolymorphicOptionsEqual(existing, p *PolymorphicOptions) bool {
	ret := change.CompareNilVals(existing == nil, p == nil)
	if ret != nil {
		return *ret
	}

	return stringListEqual(existing.Types, p.Types) &&
		existing.HideFromInverseGraphQL == p.HideFromInverseGraphQL &&
		existing.DisableBuilderType == p.DisableBuilderType
}
