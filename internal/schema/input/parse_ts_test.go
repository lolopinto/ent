package input_test

import (
	"path/filepath"
	"testing"

	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/internal/schema/input"
	"github.com/lolopinto/ent/internal/schema/testhelper"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type node struct {
	tableName       string
	fields          []field
	assocEdges      []assocEdge
	assocEdgeGroups []assocEdgeGroup
	actions         []action
	enumTable       bool
	dbRows          []map[string]interface{}
	constraints     []constraint
	hideFromGraphQL bool
}

type field struct {
	name   string
	dbType input.DBType
	// provided in lieu of dbType if we wanna provide everything
	typ                     *input.FieldType
	nullable                bool
	storageKey              string
	unique                  bool
	hideFromGraphQL         bool
	private                 bool
	graphqlName             string
	index                   bool
	primaryKey              bool
	foreignKey              *[2]string
	fieldEdge               *[2]string
	serverDefault           string
	disableUserEditable     bool
	hasDefaultValueOnCreate bool
	hasDefaultValueOnEdit   bool
	polymorphic             *input.PolymorphicOptions
	derivedFields           []field
}

type assocEdge struct {
	name            string
	schemaName      string
	symmetric       bool
	unique          bool
	tableName       string
	inverseEdge     *inverseAssocEdge
	edgeActions     []action
	hideFromGraphQL bool
}

type inverseAssocEdge struct {
	name string
}

type assocEdgeGroup struct {
	name            string
	groupStatusName string
	tableName       string
	assocEdges      []assocEdge
	edgeActions     []action
	statusEnums     []string
	nullStates      []string
	nullStateFn     string
}

type action struct {
	operation        ent.ActionOperation // Todo?
	fields           []string
	actionName       string
	graphQLName      string
	hideFromGraphQL  bool
	actionOnlyFields []actionField
}

type actionField struct {
	name     string
	typ      input.ActionType
	nullable bool
}

type constraint struct {
	name      string
	typ       input.ConstraintType
	columns   []string
	fkey      *fkeyInfo
	condition string
}

type fkeyInfo struct {
	tableName string
	ondelete  input.OnDeleteFkey
	columns   []string
}

type testCase struct {
	code           map[string]string
	expectedOutput map[string]node
}

func runTestCases(t *testing.T, testCases map[string]testCase) {
	absPath, err := filepath.Abs(".")
	require.NoError(t, err)

	for key, tt := range testCases {
		t.Run(key, func(t *testing.T) {
			schema := testhelper.ParseInputSchemaForTest(t, absPath, tt.code)

			require.Len(t, schema.Nodes, len(tt.expectedOutput))

			for nodeName, expectedNode := range tt.expectedOutput {
				node := schema.Nodes[nodeName]

				require.NotNil(t, node, "node with node name %s not found", nodeName)

				assertStrEqual(t, "tableName", expectedNode.tableName, node.TableName)

				require.Equal(t, expectedNode.enumTable, node.EnumTable)
				require.Equal(t, expectedNode.dbRows, node.DBRows)

				require.Equal(t, expectedNode.hideFromGraphQL, node.HideFromGraphQL)

				for j, expField := range expectedNode.fields {
					field := node.Fields[j]

					verifyField(t, expField, field)
				}

				verifyAssocEdges(t, expectedNode.assocEdges, node.AssocEdges)

				verifyAssocEdgeGroups(t, expectedNode.assocEdgeGroups, node.AssocEdgeGroups)
				verifyActions(t, expectedNode.actions, node.Actions)
				verifyConstraints(t, expectedNode.constraints, node.Constraints)
			}
		})
	}
}

func verifyField(t *testing.T, expField field, field *input.Field) {
	if expField.typ != nil {
		assert.Equal(t, expField.typ, field.Type)
	} else {
		assert.Equal(t, expField.dbType, field.Type.DBType)

	}
	assert.Equal(t, expField.name, field.Name)

	assert.Equal(t, expField.storageKey, field.StorageKey)

	assert.Equal(t, expField.nullable, field.Nullable)
	assert.Equal(t, expField.unique, field.Unique)
	assert.Equal(t, expField.hideFromGraphQL, field.HideFromGraphQL)
	assert.Equal(t, expField.private, field.Private)
	assert.Equal(t, expField.graphqlName, field.GraphQLName)
	assert.Equal(t, expField.index, field.Index)
	assert.Equal(t, expField.primaryKey, field.PrimaryKey)
	assert.Equal(t, expField.disableUserEditable, field.DisableUserEditable)
	assert.Equal(t, expField.hasDefaultValueOnCreate, field.HasDefaultValueOnCreate)
	assert.Equal(t, expField.hasDefaultValueOnEdit, field.HasDefaultValueOnEdit)

	assert.Equal(t, expField.foreignKey, field.ForeignKey)
	assert.Equal(t, expField.fieldEdge, field.FieldEdge)
	if expField.polymorphic == nil {
		require.Nil(t, field.Polymorphic)
	} else {
		require.NotNil(t, field.Polymorphic)
		assert.Equal(t, expField.polymorphic, field.Polymorphic)
	}

	require.Len(t, expField.derivedFields, len(field.DerivedFields))

	for i, expDerivedField := range expField.derivedFields {
		derivedField := field.DerivedFields[i]
		verifyField(t, expDerivedField, derivedField)
	}
}

func verifyAssocEdgeGroups(t *testing.T, expAssocEdgeGroups []assocEdgeGroup, assocEdgeGroups []*input.AssocEdgeGroup) {
	require.Len(t, expAssocEdgeGroups, len(assocEdgeGroups))

	for j, expEdgeGroup := range expAssocEdgeGroups {
		edgeGroup := assocEdgeGroups[j]

		assert.Equal(t, expEdgeGroup.name, edgeGroup.Name)
		assert.Equal(t, expEdgeGroup.groupStatusName, edgeGroup.GroupStatusName)
		assert.Equal(t, expEdgeGroup.tableName, edgeGroup.TableName)
		assert.Equal(t, expEdgeGroup.statusEnums, edgeGroup.StatusEnums)
		assert.Equal(t, expEdgeGroup.nullStates, edgeGroup.NullStates)
		assert.Equal(t, expEdgeGroup.nullStateFn, edgeGroup.NullStateFn)

		verifyAssocEdges(t, expEdgeGroup.assocEdges, edgeGroup.AssocEdges)
		if len(expEdgeGroup.edgeActions) != 0 {
			if edgeGroup.EdgeAction != nil {
				verifyEdgeActions(t, expEdgeGroup.edgeActions, []*input.EdgeAction{edgeGroup.EdgeAction})
			} else {
				verifyEdgeActions(t, expEdgeGroup.edgeActions, edgeGroup.EdgeActions)
			}
		} else {
			require.Nil(t, edgeGroup.EdgeAction)
			require.Len(t, edgeGroup.EdgeActions, 0)
		}
	}
}

func verifyAssocEdges(t *testing.T, expAssocEdges []assocEdge, assocEdges []*input.AssocEdge) {
	require.Len(t, expAssocEdges, len(assocEdges))
	for j, expEdge := range expAssocEdges {
		edge := assocEdges[j]

		assert.Equal(t, expEdge.name, edge.Name)
		assert.Equal(t, expEdge.schemaName, edge.SchemaName)
		assert.Equal(t, expEdge.symmetric, edge.Symmetric)
		assert.Equal(t, expEdge.unique, edge.Unique)
		assert.Equal(t, expEdge.hideFromGraphQL, edge.HideFromGraphQL)

		if expEdge.inverseEdge == nil {
			assert.Nil(t, edge.InverseEdge)
		} else {
			require.NotNil(t, edge.InverseEdge)
			assert.Equal(t, expEdge.inverseEdge.name, edge.InverseEdge.Name)
		}
		verifyEdgeActions(t, expEdge.edgeActions, edge.EdgeActions)
	}
}

func verifyActions(t *testing.T, expActions []action, actions []*input.Action) {
	require.Len(t, actions, len(expActions))

	for j, expAction := range expActions {
		action := actions[j]

		assert.Equal(t, expAction.operation, action.Operation)
		assert.Equal(t, expAction.actionName, action.CustomActionName)
		assert.Equal(t, expAction.graphQLName, action.CustomGraphQLName)
		assert.Equal(t, expAction.hideFromGraphQL, action.HideFromGraphQL)
		assert.Equal(t, expAction.fields, action.Fields)

		verifyActionOnlyFields(t, expAction.actionOnlyFields, action.ActionOnlyFields)
	}
}

func verifyActionOnlyFields(t *testing.T, expActionFields []actionField, actionFields []*input.ActionField) {
	require.Len(t, actionFields, len(expActionFields))

	for j, expActionField := range expActionFields {
		actionField := actionFields[j]

		assert.Equal(t, expActionField.name, actionField.Name)
		assert.Equal(t, expActionField.nullable, actionField.Nullable)
		assert.Equal(t, expActionField.typ, actionField.Type)
	}
}

func verifyEdgeActions(t *testing.T, expActions []action, actions []*input.EdgeAction) {
	require.Len(t, actions, len(expActions))

	for j, expAction := range expActions {
		action := actions[j]

		assert.Equal(t, expAction.operation, action.Operation)
		assert.Equal(t, expAction.actionName, action.CustomActionName)
		assert.Equal(t, expAction.graphQLName, action.CustomGraphQLName)
		assert.Equal(t, expAction.hideFromGraphQL, action.HideFromGraphQL)
		verifyActionOnlyFields(t, expAction.actionOnlyFields, action.ActionOnlyFields)
	}
}

func verifyConstraints(t *testing.T, expConstraints []constraint, constraints []*input.Constraint) {
	require.Len(t, constraints, len(expConstraints))

	for j, expConstraint := range expConstraints {
		constraint := constraints[j]

		assert.Equal(t, expConstraint.name, constraint.Name)
		assert.Equal(t, expConstraint.columns, constraint.Columns)
		assert.Equal(t, expConstraint.typ, constraint.Type)
		assert.Equal(t, expConstraint.condition, constraint.Condition)
		if expConstraint.fkey == nil {
			require.Nil(t, constraint.ForeignKey)
		} else {
			require.NotNil(t, constraint.ForeignKey)

			assert.Equal(t, expConstraint.fkey.tableName, constraint.ForeignKey.TableName)
			assert.Equal(t, expConstraint.fkey.ondelete, constraint.ForeignKey.OnDelete)
			assert.Equal(t, expConstraint.fkey.columns, constraint.ForeignKey.Columns)
		}
	}
}

func assertStrEqual(t *testing.T, key, expectedValue string, value *string) {
	if expectedValue != "" {
		require.NotNil(t, value, key)
		assert.Equal(t, expectedValue, *value, key)
	} else {
		require.Nil(t, value, key)
	}
}

func getCodeWithSchema(code string) string {
	return testhelper.GetCodeWithSchema(code)
}

func nodeFields() []field {
	return []field{
		{
			name:                    "ID",
			dbType:                  input.UUID,
			primaryKey:              true,
			disableUserEditable:     true,
			hasDefaultValueOnCreate: true,
		},
		{
			name:                    "createdAt",
			dbType:                  input.Time,
			hideFromGraphQL:         true,
			disableUserEditable:     true,
			hasDefaultValueOnCreate: true,
		},
		{
			name:                    "updatedAt",
			dbType:                  input.Time,
			hideFromGraphQL:         true,
			disableUserEditable:     true,
			hasDefaultValueOnCreate: true,
			hasDefaultValueOnEdit:   true,
		},
	}
}

func fieldsWithNodeFields(fields ...field) []field {
	return append(nodeFields(), fields...)
}
