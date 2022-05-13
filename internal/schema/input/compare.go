package input

import (
	"github.com/lolopinto/ent/internal/schema/change"
	"github.com/lolopinto/ent/internal/tsimport"
)

func NodeEqual(existing, node *Node) bool {
	return existing.TableName == node.TableName &&
		fieldsEqual(existing.Fields, node.Fields) &&
		assocEdgesEqual(existing.AssocEdges, node.AssocEdges) &&
		actionsEqual(existing.Actions, node.Actions) &&
		existing.EnumTable == node.EnumTable &&
		change.MapListEqual(existing.DBRows, node.DBRows) &&
		constraintsEqual(existing.Constraints, node.Constraints) &&
		indicesEqual(existing.Indices, node.Indices) &&
		existing.HideFromGraphQL == node.HideFromGraphQL &&
		existing.EdgeConstName == node.EdgeConstName &&
		existing.PatternName == node.PatternName
}

func PatternEqual(existing, pattern *Pattern) bool {
	return existing.Name == pattern.Name &&
		fieldsEqual(existing.Fields, pattern.Fields) &&
		assocEdgesEqual(existing.AssocEdges, pattern.AssocEdges)
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
		existingField.HasFieldPrivacy == field.HasFieldPrivacy &&

		PolymorphicOptionsEqual(existingField.Polymorphic, field.Polymorphic) &&
		existingField.DerivedWhenEmbedded == field.DerivedWhenEmbedded &&
		fieldsEqual(existingField.DerivedFields, field.DerivedFields) &&
		existingField.PatternName == field.PatternName
}

func fieldTypeEqual(existing, fieldType *FieldType) bool {
	ret := change.CompareNilVals(existing == nil, fieldType == nil)
	if ret != nil {
		return *ret
	}

	return existing.DBType == fieldType.DBType &&
		fieldTypeEqual(existing.ListElemType, fieldType.ListElemType) &&
		change.StringListEqual(existing.Values, fieldType.Values) &&
		change.StringMapEqual(existing.EnumMap, fieldType.EnumMap) &&
		existing.Type == fieldType.Type &&
		existing.GraphQLType == fieldType.GraphQLType &&
		existing.CustomType == fieldType.CustomType &&
		tsimport.ImportPathEqual(existing.ImportType, fieldType.ImportType)
}

func fieldEdgeEqual(existing, fieldEdge *FieldEdge) bool {
	ret := change.CompareNilVals(existing == nil, fieldEdge == nil)
	if ret != nil {
		return *ret
	}

	return existing.Schema == fieldEdge.Schema &&
		existing.DisableBuilderType == fieldEdge.DisableBuilderType &&
		InverseFieldEdgeEqual(existing.InverseEdge, fieldEdge.InverseEdge)
}

func InverseFieldEdgeEqual(existing, inverseFieldEdge *InverseFieldEdge) bool {
	ret := change.CompareNilVals(existing == nil, inverseFieldEdge == nil)

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
	ret := change.CompareNilVals(existing == nil, fkey == nil)
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

	return change.StringListEqual(existing.Types, p.Types) &&
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
	ret := change.CompareNilVals(existing == nil, edge == nil)
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
	ret := change.CompareNilVals(existing == nil, action == nil)
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
	ret := change.CompareNilVals(existing == nil, af == nil)
	if ret != nil {
		return *ret
	}

	return existing.Name == af.Name &&
		existing.Type == af.Type &&
		existing.Nullable == af.Nullable &&
		existing.list == af.list &&
		existing.nullableContents == af.nullableContents &&
		existing.ActionName == af.ActionName &&
		change.StringListEqual(existing.ExcludedFields, af.ExcludedFields)
}

func assocEdgeGroupEqual(existing, group *AssocEdgeGroup) bool {
	return existing.Name == group.Name &&
		existing.GroupStatusName == group.GroupStatusName &&
		existing.TableName == group.TableName &&
		assocEdgesEqual(existing.AssocEdges, group.AssocEdges) &&
		edgeActionsEqual(existing.EdgeActions, group.EdgeActions) &&
		change.StringListEqual(existing.StatusEnums, group.StatusEnums) &&
		existing.NullStateFn == group.NullStateFn &&
		change.StringListEqual(existing.NullStates, group.NullStates) &&
		edgeActionEqual(existing.EdgeAction, group.EdgeAction)
}

func actionsEqual(existing, actions []*Action) bool {
	if len(existing) != len(actions) {
		return false
	}

	for i := range existing {
		if !actionEqual(existing[i], actions[i]) {
			return false
		}
	}
	return true
}

func actionEqual(existing, action *Action) bool {
	return existing.Operation == action.Operation &&
		change.StringListEqual(existing.Fields, action.Fields) &&
		change.StringListEqual(existing.ExcludedFields, action.ExcludedFields) &&
		change.StringListEqual(existing.OptionalFields, action.OptionalFields) &&
		change.StringListEqual(existing.RequiredFields, action.RequiredFields) &&
		existing.NoFields == action.NoFields &&
		existing.CustomActionName == action.CustomActionName &&
		existing.CustomInputName == action.CustomInputName &&
		existing.HideFromGraphQL == action.HideFromGraphQL &&
		actionOnlyFieldsEqual(existing.ActionOnlyFields, action.ActionOnlyFields)
}

func foreignKeyInfoEqual(existing, fkey *ForeignKeyInfo) bool {
	ret := change.CompareNilVals(existing == nil, fkey == nil)
	if ret != nil {
		return *ret
	}

	return existing.TableName == fkey.TableName &&
		change.StringListEqual(existing.Columns, fkey.Columns) &&
		existing.OnDelete == fkey.OnDelete
}

func constraintsEqual(existing, constraints []*Constraint) bool {
	if len(existing) != len(constraints) {
		return false
	}

	for i := range existing {
		if !constraintEqual(existing[i], constraints[i]) {
			return false
		}
	}
	return true
}

func constraintEqual(existing, constraint *Constraint) bool {
	ret := change.CompareNilVals(existing == nil, constraint == nil)
	if ret != nil {
		return *ret
	}

	return existing.Name == constraint.Name &&
		existing.Type == constraint.Type &&
		change.StringListEqual(existing.Columns, constraint.Columns) &&
		foreignKeyInfoEqual(existing.ForeignKey, constraint.ForeignKey) &&
		existing.Condition == constraint.Condition
}

func indicesEqual(existing, indices []*Index) bool {
	if len(existing) != len(indices) {
		return false
	}

	for i := range existing {
		if !indexEqual(existing[i], indices[i]) {
			return false
		}
	}
	return true
}

func mapifyIndices(indices []*Index) map[string]*Index {
	ret := make(map[string]*Index)
	for _, index := range indices {
		ret[index.Name] = index
	}
	return ret
}

func mapifyConstraints(constraints []*Constraint) map[string]*Constraint {
	ret := make(map[string]*Constraint)
	for _, c := range constraints {
		ret[c.Name] = c
	}
	return ret
}

// TODO tests...
func CompareIndices(existing, indices []*Index) []change.Change {
	m1 := mapifyIndices(existing)
	m2 := mapifyIndices(indices)

	ret := []change.Change{}
	for k, v := range m1 {
		v2, ok := m2[k]
		if !ok {
			ret = append(ret, change.Change{
				Change: change.RemoveIndex,
				Name:   v.Name,
			})
		} else if !indexEqual(v, v2) {
			ret = append(ret, change.Change{
				Change: change.ModifyIndex,
				Name:   v.Name,
			})
		}
	}

	for k, v2 := range m2 {
		_, ok := m1[k]
		if !ok {
			ret = append(ret, change.Change{
				Change: change.AddIndex,
				Name:   v2.Name,
			})
		}
	}
	return ret
}

func CompareConstraints(existing, constraints []*Constraint) []change.Change {
	m1 := mapifyConstraints(existing)
	m2 := mapifyConstraints(constraints)

	ret := []change.Change{}
	for k, v := range m1 {
		v2, ok := m2[k]
		if !ok {
			ret = append(ret, change.Change{
				Change: change.RemoveConstraint,
				Name:   v.Name,
			})
		} else if !constraintEqual(v, v2) {
			ret = append(ret, change.Change{
				Change: change.ModifyConstraint,
				Name:   v.Name,
			})
		}
	}

	for k, v2 := range m2 {
		_, ok := m1[k]
		if !ok {
			ret = append(ret, change.Change{
				Change: change.AddConstraint,
				Name:   v2.Name,
			})
		}
	}
	return ret
}

func indexEqual(existing, index *Index) bool {
	return existing.Name == index.Name &&
		change.StringListEqual(existing.Columns, index.Columns) &&
		existing.Unique == index.Unique &&
		fullTextEqual(existing.FullText, index.FullText)
}

func fullTextEqual(existing, fullText *FullText) bool {
	ret := change.CompareNilVals(existing == nil, fullText == nil)
	if ret != nil {
		return *ret
	}

	return existing.GeneratedColumnName == fullText.GeneratedColumnName &&
		existing.Language == fullText.Language &&
		existing.LanguageColumn == fullText.LanguageColumn &&
		existing.IndexType == fullText.IndexType &&
		fullTextWeightEqual(existing.Weights, fullText.Weights)
}

func fullTextWeightEqual(existing, weights *FullTextWeight) bool {
	ret := change.CompareNilVals(existing == nil, weights == nil)
	if ret != nil {
		return *ret
	}

	return change.StringListEqual(existing.A, weights.A) &&
		change.StringListEqual(existing.A, weights.B) &&
		change.StringListEqual(existing.A, weights.C) &&
		change.StringListEqual(existing.A, weights.D)
}
