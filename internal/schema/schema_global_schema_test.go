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
							DBType:         input.StringEnum,
							GlobalEnumType: "DayOfWeek",
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
							DBType:         input.StringEnum,
							GlobalEnumType: "DayOfWeek",
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
							GlobalEnumType: "DayOfWeek",
							DBType:         input.StringEnum,
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
							DBType:         input.StringEnum,
							GlobalEnumType: "DayOfWeek",
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
							DBType:         input.StringEnum,
							GlobalEnumType: "DayOfWeek",
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
							DBType:         input.StringEnum,
							GlobalEnumType: "DayOfWeek",
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
							DBType:         input.StringEnum,
							GlobalEnumType: "DayOfWeek",
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
