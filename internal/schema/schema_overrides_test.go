package schema_test

import (
	"fmt"
	"testing"

	"github.com/lolopinto/ent/internal/codegen/codegenapi"
	"github.com/lolopinto/ent/internal/field"
	"github.com/lolopinto/ent/internal/schema"
	"github.com/lolopinto/ent/internal/schema/base"
	"github.com/lolopinto/ent/internal/schema/input"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func getTestFieldInfo(t *testing.T, nodeName string, fields []*input.Field) *field.FieldInfo {
	fi, err := field.NewFieldInfoFromInputs(&codegenapi.DummyConfig{}, nodeName, fields, &field.Options{})
	require.Nil(t, err)
	return fi
}

func TestOverrides(t *testing.T) {
	dv := "now()"
	cases := map[string]*overrideTestCase{
		"index override": {
			schema: &input.Schema{
				Patterns: map[string]*input.Pattern{
					"node": {
						Name: "node",
						Fields: []*input.Field{
							{
								Name: "id",
								Type: &input.FieldType{
									DBType: input.UUID,
								},
								PrimaryKey: true,
							},
							{
								Name: "createdAt",
								Type: &input.FieldType{
									DBType: input.Timestamp,
								},
							},
							{
								Name: "updatedAt",
								Type: &input.FieldType{
									DBType: input.Timestamp,
								},
							},
						},
					},
				},
				Nodes: map[string]*input.Node{
					"User": {
						Fields: []*input.Field{
							{
								Name: "id",
								Type: &input.FieldType{
									DBType: input.UUID,
								},
								PrimaryKey: true,
							},
							{
								Name: "createdAt",
								Type: &input.FieldType{
									DBType: input.Timestamp,
								},
								PatternName: "node",
							},
							{
								Name: "updatedAt",
								Type: &input.FieldType{
									DBType: input.Timestamp,
								},
								PatternName: "node",
							},
							{
								Name: "name",
								Type: &input.FieldType{
									DBType: input.String,
								},
							},
						},
						FieldOverrides: map[string]*input.FieldOverride{
							"createdAt": {
								Index: true,
							},
						},
					},
				},
			},
			expectedMap: map[string]*schema.NodeData{
				"User": {
					FieldInfo: getTestFieldInfo(t, "User", []*input.Field{
						{
							Name:       "id",
							PrimaryKey: true,
							Type: &input.FieldType{
								DBType: input.UUID,
							},
						},
						{
							Name: "createdAt",
							Type: &input.FieldType{
								DBType: input.Timestamp,
							},
							Index: true,
						},
						{
							Name: "updatedAt",
							Type: &input.FieldType{
								DBType: input.Timestamp,
							},
						},
					}),
				},
			},
		},
		"nullable override": {
			schema: &input.Schema{
				Patterns: map[string]*input.Pattern{
					"node": {
						Name: "node",
						Fields: []*input.Field{
							{
								Name: "id",
								Type: &input.FieldType{
									DBType: input.UUID,
								},
								PrimaryKey: true,
							},
							{
								Name: "createdAt",
								Type: &input.FieldType{
									DBType: input.Timestamp,
								},
							},
							{
								Name: "updatedAt",
								Type: &input.FieldType{
									DBType: input.Timestamp,
								},
							},
						},
					},
				},
				Nodes: map[string]*input.Node{
					"User": {
						Fields: []*input.Field{
							{
								Name: "id",
								Type: &input.FieldType{
									DBType: input.UUID,
								},
								PrimaryKey: true,
							},
							{
								Name: "createdAt",
								Type: &input.FieldType{
									DBType: input.Timestamp,
								},
								PatternName: "node",
							},
							{
								Name: "updatedAt",
								Type: &input.FieldType{
									DBType: input.Timestamp,
								},
								PatternName: "node",
							},
							{
								Name: "name",
								Type: &input.FieldType{
									DBType: input.String,
								},
							},
						},
						FieldOverrides: map[string]*input.FieldOverride{
							"createdAt": {
								Nullable: true,
							},
						},
					},
				},
			},
			expectedMap: map[string]*schema.NodeData{
				"User": {
					FieldInfo: getTestFieldInfo(t, "User", []*input.Field{
						{
							Name:       "id",
							PrimaryKey: true,
							Type: &input.FieldType{
								DBType: input.UUID,
							},
						},
						{
							Name: "createdAt",
							Type: &input.FieldType{
								DBType: input.Timestamp,
							},
							Nullable: true,
						},
						{
							Name: "updatedAt",
							Type: &input.FieldType{
								DBType: input.Timestamp,
							},
						},
					}),
				},
			},
		},
		"unique override": {
			schema: &input.Schema{
				Patterns: map[string]*input.Pattern{
					"node": {
						Name: "node",
						Fields: []*input.Field{
							{
								Name: "id",
								Type: &input.FieldType{
									DBType: input.UUID,
								},
								PrimaryKey: true,
							},
							{
								Name: "createdAt",
								Type: &input.FieldType{
									DBType: input.Timestamp,
								},
							},
							{
								Name: "updatedAt",
								Type: &input.FieldType{
									DBType: input.Timestamp,
								},
							},
						},
					},
				},
				Nodes: map[string]*input.Node{
					"User": {
						Fields: []*input.Field{
							{
								Name: "id",
								Type: &input.FieldType{
									DBType: input.UUID,
								},
								PrimaryKey: true,
							},
							{
								Name: "createdAt",
								Type: &input.FieldType{
									DBType: input.Timestamp,
								},
								PatternName: "node",
							},
							{
								Name: "updatedAt",
								Type: &input.FieldType{
									DBType: input.Timestamp,
								},
								PatternName: "node",
							},
							{
								Name: "name",
								Type: &input.FieldType{
									DBType: input.String,
								},
							},
						},
						FieldOverrides: map[string]*input.FieldOverride{
							"createdAt": {
								Unique: true,
							},
						},
					},
				},
			},
			expectedMap: map[string]*schema.NodeData{
				"User": {
					FieldInfo: getTestFieldInfo(t, "User", []*input.Field{
						{
							Name:       "id",
							PrimaryKey: true,
							Type: &input.FieldType{
								DBType: input.UUID,
							},
						},
						{
							Name: "createdAt",
							Type: &input.FieldType{
								DBType: input.Timestamp,
							},
							Unique: true,
						},
						{
							Name: "updatedAt",
							Type: &input.FieldType{
								DBType: input.Timestamp,
							},
						},
					}),
				},
			},
		},
		"server default override": {
			schema: &input.Schema{
				Patterns: map[string]*input.Pattern{
					"node": {
						Name: "node",
						Fields: []*input.Field{
							{
								Name: "id",
								Type: &input.FieldType{
									DBType: input.UUID,
								},
								PrimaryKey: true,
							},
							{
								Name: "createdAt",
								Type: &input.FieldType{
									DBType: input.Timestamp,
								},
							},
							{
								Name: "updatedAt",
								Type: &input.FieldType{
									DBType: input.Timestamp,
								},
							},
						},
					},
				},
				Nodes: map[string]*input.Node{
					"User": {
						Fields: []*input.Field{
							{
								Name: "id",
								Type: &input.FieldType{
									DBType: input.UUID,
								},
								PrimaryKey: true,
							},
							{
								Name: "createdAt",
								Type: &input.FieldType{
									DBType: input.Timestamp,
								},
								PatternName: "node",
							},
							{
								Name: "updatedAt",
								Type: &input.FieldType{
									DBType: input.Timestamp,
								},
								PatternName: "node",
							},
							{
								Name: "name",
								Type: &input.FieldType{
									DBType: input.String,
								},
							},
						},
						FieldOverrides: map[string]*input.FieldOverride{
							"createdAt": {
								ServerDefault: &dv,
							},
						},
					},
				},
			},
			expectedMap: map[string]*schema.NodeData{
				"User": {
					FieldInfo: getTestFieldInfo(t, "User", []*input.Field{
						{
							Name:       "id",
							PrimaryKey: true,
							Type: &input.FieldType{
								DBType: input.UUID,
							},
						},
						{
							Name: "createdAt",
							Type: &input.FieldType{
								DBType: input.Timestamp,
							},
							ServerDefault: &dv,
						},
						{
							Name: "updatedAt",
							Type: &input.FieldType{
								DBType: input.Timestamp,
							},
						},
					}),
				},
			},
		},
		"expose to graphql override": {
			schema: &input.Schema{
				Patterns: map[string]*input.Pattern{
					"node": {
						Name: "node",
						Fields: []*input.Field{
							{
								Name: "id",
								Type: &input.FieldType{
									DBType: input.UUID,
								},
								PrimaryKey: true,
							},
							{
								Name: "createdAt",
								Type: &input.FieldType{
									DBType: input.Timestamp,
								},
								HideFromGraphQL: true,
							},
							{
								Name: "updatedAt",
								Type: &input.FieldType{
									DBType: input.Timestamp,
								},
								HideFromGraphQL: true,
							},
						},
					},
				},
				Nodes: map[string]*input.Node{
					"User": {
						Fields: []*input.Field{
							{
								Name: "id",
								Type: &input.FieldType{
									DBType: input.UUID,
								},
								PrimaryKey: true,
							},
							{
								Name: "createdAt",
								Type: &input.FieldType{
									DBType: input.Timestamp,
								},
								HideFromGraphQL: true,
								PatternName:     "node",
							},
							{
								Name: "updatedAt",
								Type: &input.FieldType{
									DBType: input.Timestamp,
								},
								HideFromGraphQL: true,
								PatternName:     "node",
							},
							{
								Name: "name",
								Type: &input.FieldType{
									DBType: input.String,
								},
							},
						},
						FieldOverrides: map[string]*input.FieldOverride{
							"createdAt": {
								HideFromGraphQL: false,
							},
						},
					},
				},
			},
			expectedMap: map[string]*schema.NodeData{
				"User": {
					FieldInfo: getTestFieldInfo(t, "User", []*input.Field{
						{
							Name:       "id",
							PrimaryKey: true,
							Type: &input.FieldType{
								DBType: input.UUID,
							},
						},
						{
							Name: "createdAt",
							Type: &input.FieldType{
								DBType: input.Timestamp,
							},
							HideFromGraphQL: false,
						},
						{
							Name: "updatedAt",
							Type: &input.FieldType{
								DBType: input.Timestamp,
							},
							HideFromGraphQL: true,
						},
					}),
				},
			},
		},
		"storage key override": {
			schema: &input.Schema{
				Patterns: map[string]*input.Pattern{
					"node": {
						Name: "node",
						Fields: []*input.Field{
							{
								Name: "id",
								Type: &input.FieldType{
									DBType: input.UUID,
								},
								PrimaryKey: true,
							},
							{
								Name: "createdAt",
								Type: &input.FieldType{
									DBType: input.Timestamp,
								},
							},
							{
								Name: "updatedAt",
								Type: &input.FieldType{
									DBType: input.Timestamp,
								},
							},
						},
					},
				},
				Nodes: map[string]*input.Node{
					"User": {
						Fields: []*input.Field{
							{
								Name: "id",
								Type: &input.FieldType{
									DBType: input.UUID,
								},
								PrimaryKey: true,
							},
							{
								Name: "createdAt",
								Type: &input.FieldType{
									DBType: input.Timestamp,
								},
								PatternName: "node",
							},
							{
								Name: "updatedAt",
								Type: &input.FieldType{
									DBType: input.Timestamp,
								},
								PatternName: "node",
							},
							{
								Name: "name",
								Type: &input.FieldType{
									DBType: input.String,
								},
							},
						},
						FieldOverrides: map[string]*input.FieldOverride{
							"createdAt": {
								StorageKey: "time_created",
							},
						},
					},
				},
			},
			expectedMap: map[string]*schema.NodeData{
				"User": {
					FieldInfo: getTestFieldInfo(t, "User", []*input.Field{
						{
							Name:       "id",
							PrimaryKey: true,
							Type: &input.FieldType{
								DBType: input.UUID,
							},
						},
						{
							Name: "createdAt",
							Type: &input.FieldType{
								DBType: input.Timestamp,
							},
							StorageKey: "time_created",
						},
						{
							Name: "updatedAt",
							Type: &input.FieldType{
								DBType: input.Timestamp,
							},
						},
					}),
				},
			},
		},
		"graphql name override": {
			schema: &input.Schema{
				Patterns: map[string]*input.Pattern{
					"node": {
						Name: "node",
						Fields: []*input.Field{
							{
								Name: "id",
								Type: &input.FieldType{
									DBType: input.UUID,
								},
								PrimaryKey: true,
							},
							{
								Name: "createdAt",
								Type: &input.FieldType{
									DBType: input.Timestamp,
								},
							},
							{
								Name: "updatedAt",
								Type: &input.FieldType{
									DBType: input.Timestamp,
								},
							},
						},
					},
				},
				Nodes: map[string]*input.Node{
					"User": {
						Fields: []*input.Field{
							{
								Name: "id",
								Type: &input.FieldType{
									DBType: input.UUID,
								},
								PrimaryKey: true,
							},
							{
								Name: "createdAt",
								Type: &input.FieldType{
									DBType: input.Timestamp,
								},
								PatternName: "node",
							},
							{
								Name: "updatedAt",
								Type: &input.FieldType{
									DBType: input.Timestamp,
								},
								PatternName: "node",
							},
							{
								Name: "name",
								Type: &input.FieldType{
									DBType: input.String,
								},
							},
						},
						FieldOverrides: map[string]*input.FieldOverride{
							"createdAt": {
								GraphQLName: "timeCreated",
							},
						},
					},
				},
			},
			expectedMap: map[string]*schema.NodeData{
				"User": {
					FieldInfo: getTestFieldInfo(t, "User", []*input.Field{
						{
							Name:       "id",
							PrimaryKey: true,
							Type: &input.FieldType{
								DBType: input.UUID,
							},
						},
						{
							Name: "createdAt",
							Type: &input.FieldType{
								DBType: input.Timestamp,
							},
							GraphQLName: "timeCreated",
						},
						{
							Name: "updatedAt",
							Type: &input.FieldType{
								DBType: input.Timestamp,
							},
						},
					}),
				},
			},
		},
		"invalid field": {
			schema: &input.Schema{
				Patterns: map[string]*input.Pattern{
					"node": {
						Name: "node",
						Fields: []*input.Field{
							{
								Name: "id",
								Type: &input.FieldType{
									DBType: input.UUID,
								},
								PrimaryKey: true,
							},
							{
								Name: "createdAt",
								Type: &input.FieldType{
									DBType: input.Timestamp,
								},
							},
							{
								Name: "updatedAt",
								Type: &input.FieldType{
									DBType: input.Timestamp,
								},
							},
						},
					},
				},
				Nodes: map[string]*input.Node{
					"User": {
						Fields: []*input.Field{
							{
								Name: "id",
								Type: &input.FieldType{
									DBType: input.UUID,
								},
								PrimaryKey: true,
							},
							{
								Name: "createdAt",
								Type: &input.FieldType{
									DBType: input.Timestamp,
								},
								PatternName: "node",
							},
							{
								Name: "updatedAt",
								Type: &input.FieldType{
									DBType: input.Timestamp,
								},
								PatternName: "node",
							},
							{
								Name: "name",
								Type: &input.FieldType{
									DBType: input.String,
								},
							},
						},
						FieldOverrides: map[string]*input.FieldOverride{
							"hello": {
								GraphQLName: "timeCreated",
							},
						},
					},
				},
			},
			expectedErr: fmt.Errorf("invalid Field hello passed to override for Node User"),
		},
	}

	// TODO keys that don't exist

	runOverrideTestCases(t, cases)
}

type overrideTestCase struct {
	schema      *input.Schema
	only        bool
	skip        bool
	expectedMap map[string]*schema.NodeData
	expectedErr error
}

func runOverrideTestCases(t *testing.T, testCases map[string]*overrideTestCase) {
	hasOnly := false
	for _, tt := range testCases {
		if tt.only {
			hasOnly = true
			break
		}
	}
	for key, tt := range testCases {
		if hasOnly && !tt.only || tt.skip {
			continue
		}
		t.Run(key, func(t *testing.T) {
			testOverrides(t, tt.schema, tt.expectedMap, tt.expectedErr)

		})
	}
}

func testOverrides(
	t *testing.T,
	inputSchema *input.Schema,
	expectedMap map[string]*schema.NodeData,
	expectedErr error,
) {
	s, err := schema.ParseFromInputSchema(&codegenapi.DummyConfig{}, inputSchema, base.TypeScript)
	if expectedErr != nil {
		require.Error(t, err)
		assert.Equal(t, err.Error(), expectedErr.Error())
	} else {
		require.Nil(t, err)
		require.NotNil(t, s)
	}

	for k, expNodeData := range expectedMap {
		info := s.Nodes[k+"Config"]
		require.NotNil(t, info)
		nodeData := info.NodeData

		require.NotNil(t, expNodeData)
		require.NotNil(t, nodeData)

		for _, exp := range expNodeData.FieldInfo.Fields {
			f := nodeData.FieldInfo.GetFieldByName(exp.FieldName)

			require.NotNil(t, f)

			// only test overridable attributes
			assert.Equal(t, exp.ExposeToGraphQL(), f.ExposeToGraphQL())
			assert.Equal(t, exp.Index(), f.Index())
			assert.Equal(t, exp.DefaultValue(), f.DefaultValue())
			assert.Equal(t, exp.GetGraphQLName(), f.GetGraphQLName())
			assert.Equal(t, exp.GetDbColName(), f.GetDbColName())
			assert.Equal(t, exp.Unique(), f.Unique())
			assert.Equal(t, exp.Nullable(), f.Nullable())

		}
	}
}
