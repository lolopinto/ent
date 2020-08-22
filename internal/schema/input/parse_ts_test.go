package input_test

import (
	"io/ioutil"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/internal/schema/input"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type node struct {
	tableName       string
	fields          []field
	assocEdges      []assocEdge
	assocEdgeGroups []assocEdgeGroup
	actions         []action
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
}

type assocEdge struct {
	name        string
	schemaName  string
	symmetric   bool
	unique      bool
	tableName   string
	inverseEdge *inverseAssocEdge
	edgeActions []action
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
}

type action struct {
	operation       ent.ActionOperation // Todo?
	fields          []string
	actionName      string
	graphQLName     string
	hideFromGraphQL bool
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
			dirPath, err := ioutil.TempDir(absPath, "project")
			// delete temporary created file
			defer os.RemoveAll(dirPath)
			require.NoError(t, err)

			schemaDir := filepath.Join(dirPath, "src", "schema")
			require.NoError(t, os.MkdirAll(schemaDir, os.ModePerm))

			for fileName, contents := range tt.code {
				path := filepath.Join(schemaDir, fileName)
				require.NoError(t, ioutil.WriteFile(path, []byte(contents), os.ModePerm))
			}

			schema, err := input.ParseSchemaFromTSDir(dirPath, true)
			require.NoError(t, err)

			require.NotNil(t, schema)

			require.Len(t, schema.Nodes, len(tt.expectedOutput))

			for nodeName, expectedNode := range tt.expectedOutput {
				node := schema.Nodes[nodeName]

				require.NotNil(t, node, "node with node name %s not found", nodeName)

				assertStrEqual(t, "tableName", expectedNode.tableName, node.TableName)

				for j, expField := range expectedNode.fields {
					field := node.Fields[j]

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
				}

				verifyAssocEdges(t, expectedNode.assocEdges, node.AssocEdges)

				for j, expEdgeGroup := range expectedNode.assocEdgeGroups {
					edgeGroup := node.AssocEdgeGroups[j]

					assert.Equal(t, expEdgeGroup.name, edgeGroup.Name)
					assert.Equal(t, expEdgeGroup.groupStatusName, edgeGroup.GroupStatusName)
					assert.Equal(t, expEdgeGroup.tableName, edgeGroup.TableName)

					verifyAssocEdges(t, expEdgeGroup.assocEdges, edgeGroup.AssocEdges)
				}

				verifyActions(t, expectedNode.actions, node.Actions)
			}
		})
	}
}

func verifyAssocEdges(t *testing.T, expAssocEdges []assocEdge, assocEdges []*input.AssocEdge) {
	for j, expEdge := range expAssocEdges {
		edge := assocEdges[j]

		assert.Equal(t, expEdge.name, edge.Name)
		assert.Equal(t, expEdge.schemaName, edge.SchemaName)
		assert.Equal(t, expEdge.symmetric, edge.Symmetric)
		assert.Equal(t, expEdge.unique, edge.Unique)

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
	schemaPath := input.GetAbsoluteSchemaPathForTest()
	fieldPath := strings.Replace(schemaPath, "schema", "field", 1)

	r := strings.NewReplacer("{schema}", schemaPath, "{field}", fieldPath)
	return r.Replace(code)
}
