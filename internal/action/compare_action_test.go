package action

import (
	"testing"

	"github.com/lolopinto/ent/internal/edge"
	"github.com/lolopinto/ent/internal/enttype"
	"github.com/lolopinto/ent/internal/field"
	"github.com/lolopinto/ent/internal/schema/base"
	"github.com/lolopinto/ent/internal/schema/input"
	"github.com/stretchr/testify/require"
)

func TestCompareCreateAction(t *testing.T) {
	a1 := createNodeActionWithOptions(
		"User",
		&createActionType{},
		&actionOptions{
			fields: []*field.Field{
				field.NewFieldFromNameAndType("first_name", &enttype.StringType{}),
			},
		},
	)

	a2 := createNodeActionWithOptions(
		"User",
		&createActionType{},
		&actionOptions{
			fields: []*field.Field{
				field.NewFieldFromNameAndType("first_name", &enttype.StringType{}),
			},
		},
	)

	require.True(t, ActionEqual(a1, a2))
}

func TestCompareEditAction(t *testing.T) {
	a1 := createNodeActionWithOptions(
		"User",
		&editActionType{},
		&actionOptions{
			fields: []*field.Field{
				field.NewFieldFromNameAndType("first_name", &enttype.StringType{}),
			},
		},
	)

	a2 := createNodeActionWithOptions(
		"User",
		&editActionType{},
		&actionOptions{
			fields: []*field.Field{
				field.NewFieldFromNameAndType("first_name", &enttype.StringType{}),
			},
		},
	)

	require.True(t, ActionEqual(a1, a2))
}

func TestCompareDeleteAction(t *testing.T) {
	a1 := createNodeActionWithOptions(
		"User",
		&deleteActionType{},
		&actionOptions{},
	)

	a2 := createNodeActionWithOptions(
		"User",
		&deleteActionType{},
		&actionOptions{},
	)

	require.True(t, ActionEqual(a1, a2))
}

func TestCompareDeleteActionWithNonEntFields(t *testing.T) {
	a1 := createNodeActionWithOptions(
		"User",
		&deleteActionType{},
		&actionOptions{
			nonEntFields: []*field.NonEntField{
				{
					FieldName: "log",
					FieldType: &enttype.BoolType{},
				},
			},
		},
	)

	a2 := createNodeActionWithOptions(
		"User",
		&deleteActionType{},
		&actionOptions{
			nonEntFields: []*field.NonEntField{
				{
					FieldName: "log",
					FieldType: &enttype.BoolType{},
				},
			},
		},
	)

	require.True(t, ActionEqual(a1, a2))
}

func TestCompareDiffActions(t *testing.T) {
	a1 := createNodeActionWithOptions(
		"User",
		&editActionType{},
		&actionOptions{
			fields: []*field.Field{
				field.NewFieldFromNameAndType("first_name", &enttype.StringType{}),
			},
		},
	)

	a2 := createNodeActionWithOptions(
		"User",
		&createActionType{},
		&actionOptions{
			fields: []*field.Field{
				field.NewFieldFromNameAndType("first_name", &enttype.StringType{}),
			},
		},
	)

	require.False(t, ActionEqual(a1, a2))
}

func TestCompareCreateActionWithDiffFields(t *testing.T) {
	a1 := createNodeActionWithOptions(
		"User",
		&createActionType{},
		&actionOptions{
			fields: []*field.Field{
				field.NewFieldFromNameAndType("first_name", &enttype.StringType{}),
			},
		},
	)

	a2 := createNodeActionWithOptions(
		"User",
		&createActionType{},
		&actionOptions{
			fields: []*field.Field{
				field.NewFieldFromNameAndType("first_name", &enttype.StringType{}),
				field.NewFieldFromNameAndType("last_name", &enttype.StringType{}),
			},
		},
	)

	require.False(t, ActionEqual(a1, a2))
}

func TestCompareAddEdgeAction(t *testing.T) {
	edge1, err := edge.AssocEdgeFromInput("user", &input.AssocEdge{
		SchemaName: "User",
		Name:       "createdEvents",
	})
	require.Nil(t, err)
	edge2, err := edge.AssocEdgeFromInput("user", &input.AssocEdge{
		SchemaName: "User",
		Name:       "createdEvents",
	})
	require.Nil(t, err)

	a1 := createEdgeActionWithOptions(
		"User",
		edge1,
		&addEdgeActionType{},
		&actionOptions{
			edgeAction: &edge.EdgeAction{
				Action: "ent.AddEdgeAction",
			},
		},
	)

	a2 := createEdgeActionWithOptions(
		"User",
		edge2,
		&addEdgeActionType{},
		&actionOptions{
			edgeAction: &edge.EdgeAction{
				Action: "ent.AddEdgeAction",
			},
		},
	)

	require.True(t, ActionEqual(a1, a2))
}

func TestCompareRemoveEdgeAction(t *testing.T) {
	edge1, err := edge.AssocEdgeFromInput("user", &input.AssocEdge{
		SchemaName: "User",
		Name:       "createdEvents",
	})
	require.Nil(t, err)
	edge2, err := edge.AssocEdgeFromInput("user", &input.AssocEdge{
		SchemaName: "User",
		Name:       "createdEvents",
	})
	require.Nil(t, err)

	a1 := createEdgeActionWithOptions(
		"User",
		edge1,
		&removeEdgeActionType{},
		&actionOptions{
			edgeAction: &edge.EdgeAction{
				Action: "ent.RemoveEdgeAction",
			},
		},
	)

	a2 := createEdgeActionWithOptions(
		"User",
		edge2,
		&removeEdgeActionType{},
		&actionOptions{
			edgeAction: &edge.EdgeAction{
				Action: "ent.RemoveEdgeAction",
			},
		},
	)

	require.True(t, ActionEqual(a1, a2))
}

// TODO custom interface
// custom names e.g. actionName, inputName, gqlName
// exposeToGraphQL change...

// TODO
// also tests tsEnums,gqlEnums
// func TestCompareEdgeGroupAction(t *testing.T) {
// 	edge1, err := edge.AssocEdgeFromInput("user", &input.AssocEdge{
// 		SchemaName: "User",
// 		Name:       "createdEvents",
// 	})
// 	require.Nil(t, err)
// 	edge2, err := edge.AssocEdgeFromInput("user", &input.AssocEdge{
// 		SchemaName: "User",
// 		Name:       "createdEvents",
// 	})
// 	require.Nil(t, err)

// 	a1 := createEdgeActionWithOptions(
// 		"User",
// 		edge1,
// 		&removeEdgeActionType{},
// 		&actionOptions{
// 			edgeAction: &edge.EdgeAction{
// 				Action: "ent.EdgeGroupAction",
// 			},
// 		},
// 	)

// 	a2 := createEdgeActionWithOptions(
// 		"User",
// 		edge2,
// 		&removeEdgeActionType{},
// 		&actionOptions{
// 			edgeAction: &edge.EdgeAction{
// 				Action: "ent.EdgeGroupAction",
// 			},
// 		},
// 	)

// 	require.True(t, ActionEqual(a1, a2))

// }

type actionOptions struct {
	customActionName, customGraphQLName, customInputName string
	hideFromGraphQL                                      bool
	fields                                               []*field.Field
	nonEntFields                                         []*field.NonEntField
	edgeAction                                           *edge.EdgeAction
}

func createNodeActionWithOptions(
	nodeName string,
	typ concreteNodeActionType,
	opt *actionOptions) Action {
	ci := getCommonInfo(
		nodeName,
		typ,
		opt.customActionName,
		opt.customGraphQLName,
		opt.customInputName,
		!opt.hideFromGraphQL,
		opt.fields,
		opt.nonEntFields,
	)
	return typ.getAction(ci)
}

func createEdgeActionWithOptions(nodeName string, assocEdge *edge.AssociationEdge, typ concreteEdgeActionType, opt *actionOptions) Action {
	ci := getCommonInfoForEdgeAction(
		nodeName,
		assocEdge,
		typ,
		opt.edgeAction,
		base.TypeScript,
	)
	return typ.getAction(ci)
}
