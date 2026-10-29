package schema_test

import (
	"testing"

	"github.com/lolopinto/ent/internal/schema/base"
	"github.com/lolopinto/ent/internal/schema/input"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func inverseFieldEdgePrivacySchema(addressField *input.Field, eventEdges []*input.AssocEdge) *input.Schema {
	return &input.Schema{
		Nodes: map[string]*input.Node{
			"Address": {
				Fields: []*input.Field{
					{
						Name:       "id",
						Type:       &input.FieldType{DBType: input.UUID},
						PrimaryKey: true,
					},
				},
				AssocEdges: eventEdges,
			},
			"Event": {
				Fields: []*input.Field{
					{
						Name:       "id",
						Type:       &input.FieldType{DBType: input.UUID},
						PrimaryKey: true,
					},
					addressField,
				},
			},
		},
	}
}

func restrictedAddressIDField(restrict func(f *input.Field), inverseEdge *input.InverseFieldEdge) *input.Field {
	f := &input.Field{
		Name:     "addressID",
		Type:     &input.FieldType{DBType: input.UUID},
		Nullable: true,
		FieldEdge: &input.FieldEdge{
			Schema:      "Address",
			InverseEdge: inverseEdge,
		},
	}
	if restrict != nil {
		restrict(f)
	}
	return f
}

func TestInverseFieldEdgeOnFieldWithFieldPrivacy(t *testing.T) {
	restrict := func(f *input.Field) { f.HasFieldPrivacy = true }

	_, err := parseFromInputSchema(
		inverseFieldEdgePrivacySchema(
			restrictedAddressIDField(restrict, &input.InverseFieldEdge{Name: "hostedEvents"}),
			nil,
		),
		base.TypeScript,
	)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "field addressID has field privacy")
	assert.Contains(t, err.Error(), "hostedEvents")
	assert.Contains(t, err.Error(), "hideFromGraphQL")

	s, err := parseFromInputSchema(
		inverseFieldEdgePrivacySchema(
			restrictedAddressIDField(restrict, &input.InverseFieldEdge{Name: "hostedEvents", HideFromGraphQL: true}),
			nil,
		),
		base.TypeScript,
	)
	require.NoError(t, err)
	hostedEvents := s.Nodes["Address"].NodeData.EdgeInfo.GetAssociationEdgeByName("hostedEvents")
	require.NotNil(t, hostedEvents)
	assert.True(t, hostedEvents.HideFromGraphQL())
	// the edge is still written and queryable from TS
	addressID := s.Nodes["Event"].NodeData.FieldInfo.GetFieldByName("addressID")
	require.NotNil(t, addressID)
	require.NotNil(t, addressID.GetInverseEdge())
}

// private and dbOnly fields aren't readable from GraphQL so they must not
// generate an inverse edge that would reveal the relationship
func TestInverseFieldEdgeOnPrivateOrDBOnlyField(t *testing.T) {
	restrictions := map[string]func(f *input.Field){
		"private": func(f *input.Field) { f.Private = &input.PrivateOptions{} },
		"dbOnly":  func(f *input.Field) { f.DBOnly = true },
	}

	for name, restrict := range restrictions {
		t.Run(name, func(t *testing.T) {
			s, err := parseFromInputSchema(
				inverseFieldEdgePrivacySchema(
					restrictedAddressIDField(restrict, &input.InverseFieldEdge{Name: "hostedEvents"}),
					nil,
				),
				base.TypeScript,
			)
			require.NoError(t, err)
			assert.Nil(t, s.Nodes["Address"].NodeData.EdgeInfo.GetAssociationEdgeByName("hostedEvents"))
			assert.Len(t, s.Nodes["Address"].NodeData.EdgeInfo.GetConnectionEdges(), 0)
		})
	}
}

func TestInverseFieldEdgeOnFieldWithFieldPrivacyUsesExistingEdge(t *testing.T) {
	restrict := func(f *input.Field) { f.HasFieldPrivacy = true }

	// the edge is declared on the other schema; its own hideFromGraphQL decides
	_, err := parseFromInputSchema(
		inverseFieldEdgePrivacySchema(
			restrictedAddressIDField(restrict, &input.InverseFieldEdge{Name: "hostedEvents"}),
			[]*input.AssocEdge{{Name: "hostedEvents", SchemaName: "Event"}},
		),
		base.TypeScript,
	)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "field addressID has field privacy")

	s, err := parseFromInputSchema(
		inverseFieldEdgePrivacySchema(
			restrictedAddressIDField(restrict, &input.InverseFieldEdge{Name: "hostedEvents"}),
			[]*input.AssocEdge{{Name: "hostedEvents", SchemaName: "Event", HideFromGraphQL: true}},
		),
		base.TypeScript,
	)
	require.NoError(t, err)
	require.NotNil(t, s.Nodes["Address"].NodeData.EdgeInfo.GetAssociationEdgeByName("hostedEvents"))
}

func TestInverseFieldEdgeOnUnrestrictedField(t *testing.T) {
	s, err := parseFromInputSchema(
		inverseFieldEdgePrivacySchema(
			restrictedAddressIDField(nil, &input.InverseFieldEdge{Name: "hostedEvents"}),
			nil,
		),
		base.TypeScript,
	)
	require.NoError(t, err)
	hostedEvents := s.Nodes["Address"].NodeData.EdgeInfo.GetAssociationEdgeByName("hostedEvents")
	require.NotNil(t, hostedEvents)
	assert.False(t, hostedEvents.HideFromGraphQL())
}
