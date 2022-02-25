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

// TODO kill
// we're going to store in input schema format but compre in
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

		if fieldEqual(existingField, field) {
			continue
		}

		if existingField.HideFromGraphQL != field.HideFromGraphQL ||
			existingField.GraphQLName != field.GraphQLName {
			ret = append(ret, Change{
				Change:      AlterField,
				Field:       existingField.Name,
				GraphQLOnly: true,
			})
		} else {
			ret = append(ret, Change{
				Change: AlterField,
				Field:  existingField.Name,
			})
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

func fieldsEqual(existing, fields []*Field) bool {
	if len(existing) != len(fields) {
		return false
	}
	for i := range existing {
		if !fieldEqual(existing[i], fields[i]) {
			return false
		}
	}
	return true
}

func fieldEqual(existingField, field *Field) bool {
	return existingField.Name == field.Name &&
		fieldTypeEqual(existingField.Type, field.Type) &&

		existingField.Nullable == field.Nullable &&
		existingField.StorageKey == field.StorageKey &&
		existingField.Unique == field.Unique &&
		existingField.HideFromGraphQL == field.HideFromGraphQL &&
		existingField.Private == field.Private &&
		existingField.GraphQLName == field.GraphQLName &&
		existingField.Index == field.Index &&
		existingField.PrimaryKey == field.PrimaryKey &&

		existingField.DefaultToViewerOnCreate == field.DefaultToViewerOnCreate &&
		fieldEdgeEqual(existingField.FieldEdge, field.FieldEdge) &&
		foreignKeyEqual(existingField.ForeignKey, field.ForeignKey) &&
		existingField.ServerDefault == field.ServerDefault &&

		existingField.DisableUserEditable == field.DisableUserEditable &&
		existingField.HasDefaultValueOnCreate == field.HasDefaultValueOnCreate &&
		existingField.HasDefaultValueOnEdit == field.HasDefaultValueOnEdit &&

		PolymorphicOptionsEqual(existingField.Polymorphic, field.Polymorphic) &&
		existingField.DerivedWhenEmbedded == field.DerivedWhenEmbedded &&
		fieldsEqual(existingField.DerivedFields, field.DerivedFields) &&
		existingField.PatternName == field.PatternName
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
	ret := compareNilVals(existing == nil, fieldType == nil)
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
	ret := compareNilVals(existing == nil, importType == nil)
	if ret != nil {
		return *ret
	}

	return existing.Path == importType.Path && existing.Type == importType.Path
}

func fieldEdgeEqual(existing, fieldEdge *FieldEdge) bool {
	ret := compareNilVals(existing == nil, fieldEdge == nil)
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
	ret := compareNilVals(existing == nil, fkey == nil)
	if ret != nil {
		return *ret
	}

	return existing.Schema == fkey.Schema &&
		existing.Column == fkey.Column &&
		existing.Name == fkey.Name &&
		existing.DisableIndex == fkey.DisableIndex &&
		existing.DisableBuilderType == fkey.DisableBuilderType
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

func assocEdgesEqual(existing, edges []*AssocEdge) bool {
	if len(existing) != len(edges) {
		return false
	}

	for i := range existing {
		if !assocEdgeEqual(existing[i], edges[i]) {
			return false
		}
	}
	return true
}

func assocEdgeEqual(existing, edge *AssocEdge) bool {
	return existing.Name == edge.Name &&
		existing.SchemaName == edge.SchemaName &&
		existing.Symmetric == edge.Symmetric &&
		existing.Unique == edge.Unique &&
		existing.TableName == edge.TableName &&
		inverseAssocEdgeEqual(existing.InverseEdge, edge.InverseEdge) &&
		edgeActionsEqual(existing.EdgeActions, edge.EdgeActions) &&
		existing.HideFromGraphQL == edge.HideFromGraphQL &&
		existing.EdgeConstName == edge.EdgeConstName &&
		existing.PatternName == edge.PatternName
}

func inverseAssocEdgeEqual(existing, edge *InverseAssocEdge) bool {
	ret := compareNilVals(existing == nil, edge == nil)
	if ret != nil {
		return *ret
	}

	return existing.Name == edge.Name &&
		existing.EdgeConstName == edge.EdgeConstName
}

func edgeActionsEqual(existing, actions []*EdgeAction) bool {
	if len(existing) != len(actions) {
		return false
	}

	for i := range existing {
		if !edgeActionEqual(existing[i], actions[i]) {
			return false
		}
	}
	return true
}

func edgeActionEqual(existing, action *EdgeAction) bool {
	ret := compareNilVals(existing == nil, action == nil)
	if ret != nil {
		return *ret
	}

	return existing.Operation == action.Operation &&
		existing.CustomActionName == action.CustomActionName &&
		existing.CustomGraphQLName == action.CustomGraphQLName &&
		existing.CustomInputName == action.CustomInputName &&
		existing.HideFromGraphQL == action.HideFromGraphQL &&
		actionOnlyFieldsEqual(existing.ActionOnlyFields, action.ActionOnlyFields)
}

func actionOnlyFieldsEqual(existing, actions []*ActionField) bool {
	if len(existing) != len(actions) {
		return false
	}

	for i := range existing {
		if !actionOnlyFieldEqual(existing[i], actions[i]) {
			return false
		}
	}
	return true
}

func actionOnlyFieldEqual(existing, af *ActionField) bool {
	ret := compareNilVals(existing == nil, af == nil)
	if ret != nil {
		return *ret
	}

	return existing.Name == af.Name &&
		existing.Type == af.Type &&
		existing.Nullable == af.Nullable &&
		existing.list == af.list &&
		existing.nullableContents == af.nullableContents &&
		existing.ActionName == af.ActionName &&
		stringListEqual(existing.ExcludedFields, af.ExcludedFields)
}

func assocEdgeGroupEqual(existing, group *AssocEdgeGroup) bool {
	return existing.Name == group.Name &&
		existing.GroupStatusName == group.GroupStatusName &&
		existing.TableName == group.TableName &&
		assocEdgesEqual(existing.AssocEdges, group.AssocEdges) &&
		edgeActionsEqual(existing.EdgeActions, group.EdgeActions) &&
		stringListEqual(existing.StatusEnums, group.StatusEnums) &&
		existing.NullStateFn == group.NullStateFn &&
		stringListEqual(existing.NullStates, group.NullStates) &&
		edgeActionEqual(existing.EdgeAction, group.EdgeAction)
}

func actionEqual(existing, action *Action) bool {
	return existing.Operation == action.Operation &&
		stringListEqual(existing.Fields, action.Fields) &&
		stringListEqual(existing.ExcludedFields, action.ExcludedFields) &&
		stringListEqual(existing.OptionalFields, action.OptionalFields) &&
		stringListEqual(existing.RequiredFields, action.RequiredFields) &&
		existing.NoFields == action.NoFields &&
		existing.CustomActionName == action.CustomActionName &&
		existing.CustomInputName == action.CustomInputName &&
		existing.HideFromGraphQL == action.HideFromGraphQL &&
		actionOnlyFieldsEqual(existing.ActionOnlyFields, action.ActionOnlyFields)
}

func foreignKeyInfoEqual(existing, fkey *ForeignKeyInfo) bool {
	ret := compareNilVals(existing == nil, fkey == nil)
	if ret != nil {
		return *ret
	}

	return existing.TableName == fkey.TableName &&
		stringListEqual(existing.Columns, fkey.Columns) &&
		existing.OnDelete == fkey.OnDelete
}

func constraintEqual(existing, constraint *Constraint) bool {
	ret := compareNilVals(existing == nil, constraint == nil)
	if ret != nil {
		return *ret
	}

	return existing.Name == constraint.Name &&
		existing.Type == constraint.Type &&
		stringListEqual(existing.Columns, constraint.Columns) &&
		foreignKeyInfoEqual(existing.ForeignKey, constraint.ForeignKey) &&
		existing.Condition == constraint.Condition
}

func indexEqual(existing, index *Index) bool {
	return existing.Name == index.Name &&
		stringListEqual(existing.Columns, index.Columns) &&
		existing.Unique == index.Unique
}
