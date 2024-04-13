package schema_test

import (
	"testing"

	"github.com/lolopinto/ent/internal/schema/base"
	"github.com/lolopinto/ent/internal/schema/input"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGlobalEdge(t *testing.T) {
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
				},
			},
		},
		GlobalSchema: &input.GlobalSchema{
			GlobalEdges: []*input.AssocEdge{
				{
					Name:       "external_info",
					SchemaName: "User",
				},
				{
					Name:       "external_info_on_wheels",
					SchemaName: "User",
				},
			},
		},
	}
	schema, err := parseFromInputSchema(inputSchema, base.TypeScript)
	require.Nil(t, err)
	assert.Len(t, schema.Nodes, 1)

	edges := schema.GetGlobalEdges()
	require.Len(t, edges, 2)

	consts := schema.GetGlobalConsts()
	groups := consts.GetConstantGroups()
	require.Len(t, groups, 1)

	edgeConsts := groups["ent.EdgeType"]
	require.Len(t, edgeConsts.Constants, 2)

	require.NotNil(t, edgeConsts.Constants["GlobalToExternalInfoOnWheelsEdge"])
	require.NotNil(t, edgeConsts.Constants["GlobalToExternalInfoEdge"])
}

func TestGlobalEdgeWithInverse(t *testing.T) {
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
				},
			},
		},
		GlobalSchema: &input.GlobalSchema{
			GlobalEdges: []*input.AssocEdge{
				{
					Name:       "external_info",
					SchemaName: "User",
					InverseEdge: &input.InverseAssocEdge{
						Name: "user_external_info",
					},
				},
			},
		},
	}

	schema, err := parseFromInputSchema(inputSchema, base.TypeScript)
	require.Nil(t, err)
	assert.Len(t, schema.Nodes, 1)

	edges := schema.GetGlobalEdges()
	require.Len(t, edges, 1)

	consts := schema.GetGlobalConsts()
	groups := consts.GetConstantGroups()
	require.Len(t, groups, 1)

	edgeConsts := groups["ent.EdgeType"]
	require.Len(t, edgeConsts.Constants, 1)

	require.NotNil(t, edgeConsts.Constants["GlobalToExternalInfoEdge"])

	user := schema.Nodes["User"]
	userGroups := user.NodeData.GetConstantGroups()
	require.Len(t, userGroups, 2)

	useEdgeConsts := userGroups["ent.EdgeType"]
	require.Len(t, useEdgeConsts.Constants, 1)

	require.NotNil(t, useEdgeConsts.Constants["UserToUserExternalInfoEdge"])
}

func TestExtraEdgeCols(t *testing.T) {
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
				},
				AssocEdges: []*input.AssocEdge{
					{
						Name:       "friends",
						SchemaName: "User",
					},
				},
			},
		},
		GlobalSchema: &input.GlobalSchema{
			ExtraEdgeFields: []*input.Field{
				{
					Name: "deleted_at",
					Type: &input.FieldType{
						DBType: input.Timestamp,
					},
				},
			},
			GlobalEdges: []*input.AssocEdge{
				{
					Name:       "external_info",
					SchemaName: "User",
					InverseEdge: &input.InverseAssocEdge{
						Name: "user_external_info",
					},
				},
			},
		},
	}

	schema, err := parseFromInputSchema(inputSchema, base.TypeScript)
	require.Nil(t, err)
	assert.Len(t, schema.Nodes, 1)

	extraFields := schema.ExtraEdgeFields()
	require.Len(t, extraFields, 1)
	require.Equal(t, extraFields[0].FieldName, "deleted_at")
}

// TODO AssocEdgeBaseImport test based on what we do in ent.yml??

func TestGlobalEnum(t *testing.T) {
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
				},
			},
		},
		GlobalSchema: &input.GlobalSchema{
			GlobalFields: []*input.Field{
				{
					Name: "DayOfWeek",
					Type: &input.FieldType{
						Values:      []string{"sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"},
						DBType:      input.StringEnum,
						Type:        "DayOfWeek",
						GraphQLType: "DayOfWeek",
					},
				},
			},
		},
	}
	schema, err := parseFromInputSchema(inputSchema, base.TypeScript)
	require.Nil(t, err)
	assert.Len(t, schema.Nodes, 1)

	assert.Len(t, schema.Enums, 1)
	for _, enum := range schema.Enums {
		assert.NotNil(t, enum.Enum)
		assert.NotNil(t, enum.GQLEnum)
		assert.Equal(t, enum.Enum.Name, "DayOfWeek")
		assert.Equal(t, enum.GQLEnum.Name, "DayOfWeek")
	}

	assert.Len(t, schema.GetGlobalEnums(), 1)

	assert.Equal(t, schema.GetGlobalEnums()["DayOfWeek"], schema.Enums["DayOfWeek"])
	tsEnums := schema.Nodes["User"].NodeData.GetTSEnums()
	require.Len(t, tsEnums, 0)
}

func TestMultiGlobalEnum(t *testing.T) {
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
				},
			},
		},
		GlobalSchema: &input.GlobalSchema{
			GlobalFields: []*input.Field{
				{
					Name: "DayOfWeek",
					Type: &input.FieldType{
						Values:      []string{"sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"},
						DBType:      input.StringEnum,
						Type:        "DayOfWeek",
						GraphQLType: "DayOfWeek",
					},
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
			},
		},
	}
	schema, err := parseFromInputSchema(inputSchema, base.TypeScript)
	require.Nil(t, err)
	assert.Len(t, schema.Nodes, 1)

	assert.Len(t, schema.Enums, 2)
	for _, enum := range schema.Enums {
		assert.NotNil(t, enum.Enum)
		assert.NotNil(t, enum.GQLEnum)
	}

	assert.Len(t, schema.GetGlobalEnums(), 2)

	assert.Equal(t, schema.GetGlobalEnums()["DayOfWeek"], schema.Enums["DayOfWeek"])
	assert.Equal(t, schema.GetGlobalEnums()["NotifType"], schema.Enums["NotifType"])

	tsEnums := schema.Nodes["User"].NodeData.GetTSEnums()
	require.Len(t, tsEnums, 0)
}

func TestGlobalEnumPlusNodes(t *testing.T) {
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
						Name: "DayOfWeek",
						Type: &input.FieldType{
							DBType:     input.StringEnum,
							GlobalType: "DayOfWeek",
						},
					},
				},
			},
			"Holiday": {
				Fields: []*input.Field{
					{
						Name: "id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						PrimaryKey: true,
					},
					{
						Name: "DayOfWeek",
						Type: &input.FieldType{
							DBType:     input.StringEnum,
							GlobalType: "DayOfWeek",
						},
					},
				},
			},
		},
		GlobalSchema: &input.GlobalSchema{
			GlobalFields: []*input.Field{
				{
					Name: "DayOfWeek",
					Type: &input.FieldType{
						Values:      []string{"sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"},
						DBType:      input.StringEnum,
						Type:        "DayOfWeek",
						GraphQLType: "DayOfWeek",
					},
				},
			},
		},
	}
	schema, err := parseFromInputSchema(inputSchema, base.TypeScript)
	require.Nil(t, err)
	assert.Len(t, schema.Nodes, 2)

	assert.Len(t, schema.Enums, 1)
	for _, enum := range schema.Enums {
		assert.NotNil(t, enum.Enum)
		assert.NotNil(t, enum.GQLEnum)
		assert.Equal(t, enum.Enum.Name, "DayOfWeek")
		assert.Equal(t, enum.GQLEnum.Name, "DayOfWeek")
	}

	assert.Len(t, schema.GetGlobalEnums(), 1)

	assert.Equal(t, schema.GetGlobalEnums()["DayOfWeek"], schema.Enums["DayOfWeek"])

	tsEnums := schema.Nodes["User"].NodeData.GetTSEnums()
	require.Len(t, tsEnums, 1)

	tsEnums2 := schema.Nodes["Holiday"].NodeData.GetTSEnums()
	require.Len(t, tsEnums2, 1)
}

func TestGlobalEnumPlusPatternAndNodes(t *testing.T) {
	inputSchema := &input.Schema{
		Patterns: map[string]*input.Pattern{
			"days": {
				Name: "days",
				Fields: []*input.Field{
					{
						Name: "DayOfWeek",
						Type: &input.FieldType{
							GlobalType: "DayOfWeek",
							DBType:     input.StringEnum,
						},
						PatternName: "days",
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
						Name: "DayOfWeek",
						Type: &input.FieldType{
							DBType:     input.StringEnum,
							GlobalType: "DayOfWeek",
						},
						PatternName: "days",
					},
				},
			},
			"Holiday": {
				Fields: []*input.Field{
					{
						Name: "id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						PrimaryKey: true,
					},
					{
						Name: "DayOfWeek",
						Type: &input.FieldType{
							DBType:     input.StringEnum,
							GlobalType: "DayOfWeek",
						},
						PatternName: "days",
					},
				},
			},
		},
		GlobalSchema: &input.GlobalSchema{
			GlobalFields: []*input.Field{
				{
					Name: "DayOfWeek",
					Type: &input.FieldType{
						Values:      []string{"sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"},
						DBType:      input.StringEnum,
						Type:        "DayOfWeek",
						GraphQLType: "DayOfWeek",
					},
				},
			},
		},
	}
	schema, err := parseFromInputSchema(inputSchema, base.TypeScript)
	require.Nil(t, err)
	assert.Len(t, schema.Nodes, 2)

	assert.Len(t, schema.Enums, 1)
	for _, enum := range schema.Enums {
		assert.NotNil(t, enum.Enum)
		assert.NotNil(t, enum.GQLEnum)
		assert.Equal(t, enum.Enum.Name, "DayOfWeek")
		assert.Equal(t, enum.GQLEnum.Name, "DayOfWeek")
	}

	assert.Len(t, schema.GetGlobalEnums(), 1)

	assert.Equal(t, schema.GetGlobalEnums()["DayOfWeek"], schema.Enums["DayOfWeek"])

	tsEnums := schema.Nodes["User"].NodeData.GetTSEnums()
	require.Len(t, tsEnums, 1)

	tsEnums2 := schema.Nodes["Holiday"].NodeData.GetTSEnums()
	require.Len(t, tsEnums2, 1)
}

func TestGlobalEnumUsedNoGlobalSchema(t *testing.T) {
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
						Name: "DayOfWeek",
						Type: &input.FieldType{
							DBType:     input.StringEnum,
							GlobalType: "DayOfWeek",
						},
					},
				},
			},
			"Holiday": {
				Fields: []*input.Field{
					{
						Name: "id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						PrimaryKey: true,
					},
					{
						Name: "DayOfWeek",
						Type: &input.FieldType{
							DBType:     input.StringEnum,
							GlobalType: "DayOfWeek",
						},
					},
				},
			},
		},
	}
	schema, err := parseFromInputSchema(inputSchema, base.TypeScript)
	require.NotNil(t, err)
	// ideally, there's a better error but this is fine
	require.Equal(t, err.Error(), "Enum DayOfWeek has no values")
	require.Nil(t, schema)
}

func TestGlobalStructPlusPatternAndNodes(t *testing.T) {
	inputSchema := &input.Schema{
		Patterns: map[string]*input.Pattern{
			"user_prefs": {
				Name: "user_prefs",
				Fields: []*input.Field{
					{
						Name: "userPrefs",
						Type: &input.FieldType{
							DBType:     input.JSONB,
							GlobalType: "UserPrefsField",
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
						Name: "UserPrefs",
						Type: &input.FieldType{
							DBType:     input.JSONB,
							GlobalType: "UserPrefsField",
						},
						PatternName: "user_prefs",
					},
				},
			},
			"Account": {
				Fields: []*input.Field{
					{
						Name: "id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						PrimaryKey: true,
					},
					{
						Name: "UserPrefs",
						Type: &input.FieldType{
							DBType:     input.JSONB,
							GlobalType: "UserPrefsField",
						},
						PatternName: "user_prefs",
					},
				},
			},
		},
		GlobalSchema: &input.GlobalSchema{
			GlobalFields: []*input.Field{
				{
					Name: "userPrefs",
					Type: &input.FieldType{
						DBType:      input.JSONB,
						Type:        "UserPrefsField",
						GraphQLType: "UserPrefsField",
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
										Type:               "NotifType",
										GraphQLType:        "NotifType",
										DBType:             input.StringEnum,
										Values:             []string{"MOBILE", "WEB", "EMAIL"},
										DisableUnknownType: true,
									},
								},
								Nullable: true,
							},
						},
					},
				},
			},
		},
	}
	schema, err := parseFromInputSchema(inputSchema, base.TypeScript)
	require.Nil(t, err)
	assert.Len(t, schema.Nodes, 2)

	require.Len(t, schema.CustomInterfaces, 1)

	ci := schema.CustomInterfaces["UserPrefsField"]
	require.NotNil(t, ci)
	require.Len(t, ci.Fields, 3)
	require.Len(t, ci.NonEntFields, 0)
	require.Len(t, ci.Children, 0)

	require.Len(t, ci.GetTSEnums(), 1)

	enum := ci.GetTSEnums()[0]
	require.Equal(t, enum.Name, "NotifType")
	validateEnumValuesEqual(t, enum, []string{"MOBILE", "WEB", "EMAIL"})

	assert.Len(t, schema.GetGlobalEnums(), 1)

	assert.Equal(t, schema.GetGlobalEnums()["NotifType"], schema.Enums["NotifType"])
}

func TestGlobalEnumUsedInStruct(t *testing.T) {
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
									Name: "daysOff",
									Type: &input.FieldType{
										DBType: input.List,
										ListElemType: &input.FieldType{
											GlobalType: "DayOfWeek",
											DBType:     input.StringEnum,
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
		GlobalSchema: &input.GlobalSchema{
			GlobalFields: []*input.Field{
				{
					Name: "DayOfWeek",
					Type: &input.FieldType{
						Values:      []string{"sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"},
						DBType:      input.StringEnum,
						Type:        "DayOfWeek",
						GraphQLType: "DayOfWeek",
					},
				},
			},
		},
	}
	schema, err := parseFromInputSchema(inputSchema, base.TypeScript)
	require.Nil(t, err)
	assert.Len(t, schema.Nodes, 1)

	userInfo := schema.Nodes["User"]
	require.NotNil(t, userInfo)

	assert.Len(t, schema.Enums, 1)
	for _, enum := range schema.Enums {
		assert.NotNil(t, enum.Enum)
		assert.NotNil(t, enum.GQLEnum)
		assert.Equal(t, enum.Enum.Name, "DayOfWeek")
		assert.Equal(t, enum.GQLEnum.Name, "DayOfWeek")
	}

	ci := schema.CustomInterfaces["UserPrefs"]
	require.NotNil(t, ci)
	require.Len(t, ci.Fields, 1)
	require.Len(t, ci.NonEntFields, 0)
	require.Len(t, ci.Children, 0)

	require.Len(t, ci.GetTSEnums(), 1)
	enum := ci.GetTSEnums()[0]
	require.Equal(t, enum.Name, "DayOfWeek")

	assert.Len(t, schema.GetGlobalEnums(), 1)

	assert.Equal(t, schema.GetGlobalEnums()["DayOfWeek"], schema.Enums["DayOfWeek"])
}
