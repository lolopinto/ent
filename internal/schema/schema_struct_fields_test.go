package schema_test

import (
	"strconv"
	"testing"

	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/internal/codegen/codegenapi"
	"github.com/lolopinto/ent/internal/schema"
	"github.com/lolopinto/ent/internal/schema/base"
	"github.com/lolopinto/ent/internal/schema/customtype"
	"github.com/lolopinto/ent/internal/schema/enum"
	"github.com/lolopinto/ent/internal/schema/input"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestWithSubFields(t *testing.T) {
	inputSchema := &input.Schema{
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
						Name: "userPrefs",
						Type: &input.FieldType{
							DBType:      input.JSONB,
							Type:        "UserPrefs",
							GraphQLType: "UserPrefs",
							SubFields: []*input.Field{
								{
									Name: "finishedNux",
									Type: &input.FieldType{
										DBType: input.Boolean,
									},
									Nullable: true,
								},
								{
									Name: "enableNotifs",
									Type: &input.FieldType{
										DBType: input.Boolean,
									},
									Nullable: true,
								},
								{
									Name: "notifTypes",
									Type: &input.FieldType{
										DBType: input.List,
										ListElemType: &input.FieldType{
											Type:        "NotifType",
											GraphQLType: "NotifType",
											DBType:      input.StringEnum,
											Values:      []string{"MOBILE", "WEB", "EMAIL"},
										},
									},
									Nullable: true,
								},
							},
						},
					},
				},
				Actions: []*input.Action{
					{
						Operation: ent.CreateAction,
					},
				},
			},
		},
	}

	schema, err := schema.ParseFromInputSchema(&codegenapi.DummyConfig{}, inputSchema, base.TypeScript)
	require.Nil(t, err)
	assert.Len(t, schema.Nodes, 1)

	userInfo := schema.Nodes["User"]
	require.NotNil(t, userInfo)

	require.Len(t, schema.CustomInterfaces, 1)

	ci := schema.CustomInterfaces["UserPrefs"]
	require.NotNil(t, ci)
	require.Len(t, ci.Fields, 3)
	require.Len(t, ci.NonEntFields, 0)
	require.Len(t, ci.Children, 0)

	require.Len(t, ci.GetTSEnums(), 1)

	enum := ci.GetTSEnums()[0]
	require.Equal(t, enum.Name, "NotifType")
	validateEnumValuesEqual(t, enum, []string{"MOBILE", "WEB", "EMAIL"})
}

func TestWithNestedSubFields(t *testing.T) {
	inputSchema := &input.Schema{
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
						Name: "userPrefs",
						Type: &input.FieldType{
							DBType:      input.JSONB,
							Type:        "UserPrefs",
							GraphQLType: "UserPrefs",
							SubFields: []*input.Field{
								{
									Name: "finishedNux",
									Type: &input.FieldType{
										DBType: input.Boolean,
									},
									Nullable: true,
								},
								{
									Name: "enableNotifs",
									Type: &input.FieldType{
										DBType: input.Boolean,
									},
									Nullable: true,
								},
								{
									Name: "notifTypes",
									Type: &input.FieldType{
										DBType:      input.StringEnum,
										Type:        "NotifType",
										GraphQLType: "NotifType",
										Values:      []string{"MOBILE", "WEB", "EMAIL"},
									},
									Nullable: true,
								},
								{
									Name: "nestedObject",
									Type: &input.FieldType{
										DBType:      input.JSONB,
										Type:        "NestedUserPrefs",
										GraphQLType: "NestedUserPrefs",
										SubFields: []*input.Field{
											{
												Name: "foo",
												Type: &input.FieldType{
													DBType: input.Boolean,
												},
											},
											{
												Name: "bar",
												Type: &input.FieldType{
													DBType: input.Boolean,
												},
											},
											{
												Name: "notifTypes",
												Type: &input.FieldType{
													DBType:      input.StringEnum,
													Type:        "NotifType2",
													GraphQLType: "NotifType2",
													Values:      []string{"MOBILE", "WEB", "EMAIL"},
												},
												Nullable: true,
											},
											{
												Name: "nestedNestedObject",
												Type: &input.FieldType{
													DBType:      input.JSONB,
													Type:        "NestedNestedUserPrefs",
													GraphQLType: "NestedNestedUserPrefs",
													SubFields: []*input.Field{
														{
															Name: "nestedFoo",
															Type: &input.FieldType{
																DBType: input.Timestamp,
															},
														},
														{
															Name: "nestedBar",
															Type: &input.FieldType{
																DBType: input.Float,
															},
														},
													},
												},
											},
										},
									},
								},
							},
						},
					},
				},
				Actions: []*input.Action{
					{
						Operation: ent.CreateAction,
					},
				},
			},
		},
	}

	schema, err := schema.ParseFromInputSchema(&codegenapi.DummyConfig{}, inputSchema, base.TypeScript)
	require.Nil(t, err)
	assert.Len(t, schema.Nodes, 1)

	userInfo := schema.Nodes["User"]
	require.NotNil(t, userInfo)

	require.Len(t, schema.CustomInterfaces, 1)

	ci := schema.CustomInterfaces["UserPrefs"]
	require.NotNil(t, ci)
	require.Len(t, ci.Fields, 4)
	require.Len(t, ci.NonEntFields, 0)
	require.Len(t, ci.Children, 2)

	child1 := ci.Children[0]
	require.Equal(t, child1.GetTSType(), "NestedUserPrefs")
	require.True(t, child1.IsCustomInterface())
	require.False(t, child1.IsCustomUnion())
	ci1 := child1.(*customtype.CustomInterface)
	require.Len(t, ci1.Fields, 4)
	require.Len(t, ci1.NonEntFields, 0)
	require.Len(t, ci1.Children, 0)
	require.Len(t, ci1.GetTSEnums(), 0)

	child2 := ci.Children[1]
	require.Equal(t, child2.GetTSType(), "NestedNestedUserPrefs")
	require.True(t, child2.IsCustomInterface())
	require.False(t, child2.IsCustomUnion())
	ci2 := child2.(*customtype.CustomInterface)
	require.Len(t, ci2.Fields, 2)
	require.Len(t, ci2.NonEntFields, 0)
	require.Len(t, ci2.Children, 0)
	require.Len(t, ci2.GetTSEnums(), 0)

	require.Len(t, ci.GetTSEnums(), 2)

	enum := ci.GetTSEnums()[0]
	require.Equal(t, enum.Name, "NotifType")
	validateEnumValuesEqual(t, enum, []string{"MOBILE", "WEB", "EMAIL"})

	enum2 := ci.GetTSEnums()[1]
	require.Equal(t, enum2.Name, "NotifType2")
	validateEnumValuesEqual(t, enum2, []string{"MOBILE", "WEB", "EMAIL"})
}

func TestWithUnionFields(t *testing.T) {
	inputSchema := &input.Schema{
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
						Name: "userPrefs",
						Type: &input.FieldType{
							DBType:      input.JSONB,
							Type:        "UserPrefs",
							GraphQLType: "UserPrefs",
							SubFields: []*input.Field{
								{
									Name: "finishedNux",
									Type: &input.FieldType{
										DBType: input.Boolean,
									},
									Nullable: true,
								},
								{
									Name: "enableNotifs",
									Type: &input.FieldType{
										DBType: input.Boolean,
									},
									Nullable: true,
								},
								{
									Name: "notifTypes",
									Type: &input.FieldType{
										DBType:      input.StringEnum,
										Type:        "NotifType",
										GraphQLType: "NotifType",
										Values:      []string{"MOBILE", "WEB", "EMAIL"},
									},
									Nullable: true,
								},
								{
									Name: "unionField",
									Type: &input.FieldType{
										DBType:      input.JSONB,
										Type:        "UnionField",
										GraphQLType: "UnionField",
										UnionFields: []*input.Field{
											{
												Name: "foo",
												Type: &input.FieldType{
													DBType:      input.JSONB,
													Type:        "FooUserPrefs",
													GraphQLType: "FooUserPrefs",
													SubFields: []*input.Field{
														{
															Name: "foo",
															Type: &input.FieldType{
																DBType: input.Boolean,
															},
														},
														{
															Name: "bar",
															Type: &input.FieldType{
																DBType: input.Boolean,
															},
														},
														{
															Name: "notifTypes",
															Type: &input.FieldType{
																DBType:      input.StringEnum,
																Type:        "NotifType2",
																GraphQLType: "NotifType2",
																Values:      []string{"MOBILE", "WEB", "EMAIL"},
															},
															Nullable: true,
														},
													},
												},
											},
											{
												Name: "foo2",
												Type: &input.FieldType{
													DBType:      input.JSONB,
													Type:        "Foo2UserPrefs",
													GraphQLType: "Foo2UserPrefs",
													SubFields: []*input.Field{
														{
															Name: "foo2",
															Type: &input.FieldType{
																DBType: input.Timestamp,
															},
														},
														{
															Name: "bar2",
															Type: &input.FieldType{
																DBType: input.Float,
															},
														},
													},
												},
											},
										},
									},
								},
							},
						},
					},
				},
				Actions: []*input.Action{
					{
						Operation: ent.CreateAction,
					},
				},
			},
		},
	}

	schema, err := schema.ParseFromInputSchema(&codegenapi.DummyConfig{}, inputSchema, base.TypeScript)
	require.Nil(t, err)
	assert.Len(t, schema.Nodes, 1)

	userInfo := schema.Nodes["User"]
	require.NotNil(t, userInfo)

	require.Len(t, schema.CustomInterfaces, 1)

	ci := schema.CustomInterfaces["UserPrefs"]
	require.NotNil(t, ci)
	require.Len(t, ci.Fields, 4)
	require.Len(t, ci.NonEntFields, 0)
	require.Len(t, ci.Children, 1)
	// TODO children. union type...

	union := ci.Children[0]
	require.Equal(t, union.GetTSType(), "UnionField")
	require.Equal(t, union.GetGraphQLName(), "UnionField")
	require.False(t, union.IsCustomInterface())
	require.True(t, union.IsCustomUnion())

	customTypes := union.GetAllCustomTypes()
	require.Len(t, customTypes, 3)

	// self is last
	require.Equal(t, union, customTypes[2])

	child1 := customTypes[0]
	ci1 := child1.(*customtype.CustomInterface)
	require.Equal(t, child1.GetTSType(), "FooUserPrefs")
	require.Equal(t, child1.GetGraphQLName(), "FooUserPrefs")
	require.True(t, child1.IsCustomInterface())
	require.False(t, child1.IsCustomUnion())
	require.Len(t, ci1.Fields, 3)
	require.Len(t, ci1.NonEntFields, 0)
	require.Len(t, ci1.Children, 0)
	require.Len(t, ci1.GetTSEnums(), 1)

	child2 := customTypes[1]
	ci2 := child2.(*customtype.CustomInterface)
	require.Equal(t, child2.GetTSType(), "Foo2UserPrefs")
	require.Equal(t, child2.GetGraphQLName(), "Foo2UserPrefs")
	require.True(t, child2.IsCustomInterface())
	require.False(t, child2.IsCustomUnion())
	require.Len(t, ci2.Fields, 2)
	require.Len(t, ci2.NonEntFields, 0)
	require.Len(t, ci2.Children, 0)
	require.Len(t, ci2.GetTSEnums(), 0)

	require.Len(t, ci.GetTSEnums(), 1)
	require.Len(t, ci.GetAllEnums(), 2)

	enum := ci.GetAllEnums()[0]
	require.Equal(t, enum.Name, "NotifType")
	validateEnumValuesEqual(t, enum, []string{"MOBILE", "WEB", "EMAIL"})

	enum2 := ci.GetAllEnums()[1]
	require.Equal(t, enum2.Name, "NotifType2")
	validateEnumValuesEqual(t, enum2, []string{"MOBILE", "WEB", "EMAIL"})
}

func TestWithSubFieldsInPattern(t *testing.T) {
	n := &input.Node{
		Fields: []*input.Field{
			{
				Name: "id",
				Type: &input.FieldType{
					DBType: input.UUID,
				},
				PrimaryKey: true,
			},
			{
				Name:        "userPrefs",
				PatternName: "pattern",
				Type: &input.FieldType{
					DBType:      input.JSONB,
					Type:        "UserPrefs",
					GraphQLType: "UserPrefs",
					SubFields: []*input.Field{
						{
							Name: "finishedNux",
							Type: &input.FieldType{
								DBType: input.Boolean,
							},
							Nullable: true,
						},
						{
							Name: "enableNotifs",
							Type: &input.FieldType{
								DBType: input.Boolean,
							},
							Nullable: true,
						},
						{
							Name: "notifTypes",
							Type: &input.FieldType{
								DBType: input.List,
								ListElemType: &input.FieldType{
									Type:        "NotifType",
									GraphQLType: "NotifType",
									DBType:      input.StringEnum,
									Values:      []string{"MOBILE", "WEB", "EMAIL"},
								},
							},
							Nullable: true,
						},
					},
				},
			},
		},
	}

	inputSchema := &input.Schema{
		Nodes: map[string]*input.Node{
			"User":  n,
			"Group": n,
		},
		Patterns: map[string]*input.Pattern{
			"pattern": {
				Name: "pattern",
				Fields: []*input.Field{
					{
						Name:        "userPrefs",
						PatternName: "pattern",
						Type: &input.FieldType{
							DBType:      input.JSONB,
							Type:        "UserPrefs",
							GraphQLType: "UserPrefs",
							SubFields: []*input.Field{
								{
									Name: "finishedNux",
									Type: &input.FieldType{
										DBType: input.Boolean,
									},
									Nullable: true,
								},
								{
									Name: "enableNotifs",
									Type: &input.FieldType{
										DBType: input.Boolean,
									},
									Nullable: true,
								},
								{
									Name: "notifTypes",
									Type: &input.FieldType{
										DBType: input.List,
										ListElemType: &input.FieldType{
											Type:        "NotifType",
											GraphQLType: "NotifType",
											DBType:      input.StringEnum,
											Values:      []string{"MOBILE", "WEB", "EMAIL"},
										},
									},
									Nullable: true,
								},
							},
						},
					},
				},
			},
		},
	}

	schema, err := schema.ParseFromInputSchema(&codegenapi.DummyConfig{}, inputSchema, base.TypeScript)
	require.Nil(t, err)
	assert.Len(t, schema.Nodes, 2)

	userNodeData, err := schema.GetNodeDataForNode("User")
	require.Nil(t, err)
	require.NotNil(t, userNodeData)

	groupNodeData, err := schema.GetNodeDataForNode("Group")
	require.Nil(t, err)
	require.NotNil(t, groupNodeData)

	require.Len(t, schema.CustomInterfaces, 1)

	ci := schema.CustomInterfaces["UserPrefs"]
	require.NotNil(t, ci)
	require.Len(t, ci.Fields, 3)
	require.Len(t, ci.NonEntFields, 0)
	require.Len(t, ci.Children, 0)

	require.Len(t, ci.GetTSEnums(), 1)

	enum := ci.GetTSEnums()[0]
	require.Equal(t, enum.Name, "NotifType")
	validateEnumValuesEqual(t, enum, []string{"MOBILE", "WEB", "EMAIL"})
}

func validateEnumValuesEqual(t *testing.T, enum *enum.Enum, values []string) {
	enumValues := enum.GetEnumValues()
	require.Equal(t, len(values), len(enumValues))

	for i, enumV := range enumValues {
		v := values[i]
		require.Equal(t, enumV.(string), strconv.Quote(v))
	}
}
