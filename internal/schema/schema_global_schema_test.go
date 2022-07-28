package schema_test

import (
	"testing"

	"github.com/davecgh/go-spew/spew"
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
	require.Len(t, edgeConsts.Constants, 2)

	require.NotNil(t, edgeConsts.Constants["GlobalToExternalInfoEdge"])
	spew.Dump(edgeConsts.Constants)
	t.Fail()
}
