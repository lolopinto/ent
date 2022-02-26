package action

import (
	"testing"

	"github.com/lolopinto/ent/internal/edge"
	"github.com/lolopinto/ent/internal/enttype"
	"github.com/lolopinto/ent/internal/field"
	"github.com/lolopinto/ent/internal/schema/base"
	"github.com/lolopinto/ent/internal/schema/enum"
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

func TestCompareActionName(t *testing.T) {
	a1 := createNodeActionWithOptions(
		"User",
		&createActionType{},
		&actionOptions{
			fields: []*field.Field{
				field.NewFieldFromNameAndType("first_name", &enttype.StringType{}),
			},
			customActionName: "CreateFooAction",
		},
	)

	a2 := createNodeActionWithOptions(
		"User",
		&createActionType{},
		&actionOptions{
			fields: []*field.Field{
				field.NewFieldFromNameAndType("first_name", &enttype.StringType{}),
			},
			customActionName: "CreateFooAction",
		},
	)

	require.True(t, ActionEqual(a1, a2))
}

func TestCompareUnequalActionName(t *testing.T) {
	a1 := createNodeActionWithOptions(
		"User",
		&createActionType{},
		&actionOptions{
			fields: []*field.Field{
				field.NewFieldFromNameAndType("first_name", &enttype.StringType{}),
			},
			customActionName: "CreateFooAction",
		},
	)

	a2 := createNodeActionWithOptions(
		"User",
		&createActionType{},
		&actionOptions{
			fields: []*field.Field{
				field.NewFieldFromNameAndType("first_name", &enttype.StringType{}),
			},
			customActionName: "CreateFooAction2",
		},
	)

	require.False(t, ActionEqual(a1, a2))
}

func TestCompareGraphQLName(t *testing.T) {
	a1 := createNodeActionWithOptions(
		"User",
		&createActionType{},
		&actionOptions{
			fields: []*field.Field{
				field.NewFieldFromNameAndType("first_name", &enttype.StringType{}),
			},
			customGraphQLName: "fooCreate",
		},
	)

	a2 := createNodeActionWithOptions(
		"User",
		&createActionType{},
		&actionOptions{
			fields: []*field.Field{
				field.NewFieldFromNameAndType("first_name", &enttype.StringType{}),
			},
			customGraphQLName: "fooCreate",
		},
	)

	require.True(t, ActionEqual(a1, a2))
}

func TestCompareUnequalGraphQLName(t *testing.T) {
	a1 := createNodeActionWithOptions(
		"User",
		&createActionType{},
		&actionOptions{
			fields: []*field.Field{
				field.NewFieldFromNameAndType("first_name", &enttype.StringType{}),
			},
			customGraphQLName: "fooCreate",
		},
	)

	a2 := createNodeActionWithOptions(
		"User",
		&createActionType{},
		&actionOptions{
			fields: []*field.Field{
				field.NewFieldFromNameAndType("first_name", &enttype.StringType{}),
			},
			customGraphQLName: "fooCreate2",
		},
	)

	require.False(t, ActionEqual(a1, a2))
}

func TestCompareInputName(t *testing.T) {
	a1 := createNodeActionWithOptions(
		"User",
		&createActionType{},
		&actionOptions{
			fields: []*field.Field{
				field.NewFieldFromNameAndType("first_name", &enttype.StringType{}),
			},
			customInputName: "CreateFooInput",
		},
	)

	a2 := createNodeActionWithOptions(
		"User",
		&createActionType{},
		&actionOptions{
			fields: []*field.Field{
				field.NewFieldFromNameAndType("first_name", &enttype.StringType{}),
			},
			customInputName: "CreateFooInput",
		},
	)

	require.True(t, ActionEqual(a1, a2))
}

func TestCompareUnequalInputName(t *testing.T) {
	a1 := createNodeActionWithOptions(
		"User",
		&createActionType{},
		&actionOptions{
			fields: []*field.Field{
				field.NewFieldFromNameAndType("first_name", &enttype.StringType{}),
			},
			customInputName: "CreateFooInput",
		},
	)

	a2 := createNodeActionWithOptions(
		"User",
		&createActionType{},
		&actionOptions{
			fields: []*field.Field{
				field.NewFieldFromNameAndType("first_name", &enttype.StringType{}),
			},
			customInputName: "CreateFooInput2",
		},
	)

	require.False(t, ActionEqual(a1, a2))
}

func TestCompareExposeToGraphQL(t *testing.T) {
	a1 := createNodeActionWithOptions(
		"User",
		&createActionType{},
		&actionOptions{
			fields: []*field.Field{
				field.NewFieldFromNameAndType("first_name", &enttype.StringType{}),
			},
			hideFromGraphQL: true,
		},
	)

	a2 := createNodeActionWithOptions(
		"User",
		&createActionType{},
		&actionOptions{
			fields: []*field.Field{
				field.NewFieldFromNameAndType("first_name", &enttype.StringType{}),
			},
			hideFromGraphQL: true,
		},
	)

	require.True(t, ActionEqual(a1, a2))
}

func TestCompareUnequalExposeToGraphQL(t *testing.T) {
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
			hideFromGraphQL: true,
		},
	)

	require.False(t, ActionEqual(a1, a2))
}

func TestCompareTsEnums(t *testing.T) {
	a1 := createNodeActionWithOptions(
		"User",
		&createActionType{},
		&actionOptions{
			fields: []*field.Field{
				field.NewFieldFromNameAndType("first_name", &enttype.StringType{}),
			},
			tsEnums: []*enum.Enum{
				{
					Name: "AccountStatus",
					Values: []enum.Data{
						{
							Name:  "Deactivated",
							Value: "deactivated",
						},
						{
							Name:  "Disabled",
							Value: "disabled",
						},
						{
							Name:  "Confirmed",
							Value: "confirmed",
						},
					},
					Imported: true,
				},
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
			tsEnums: []*enum.Enum{
				{
					Name: "AccountStatus",
					Values: []enum.Data{
						{
							Name:  "Deactivated",
							Value: "deactivated",
						},
						{
							Name:  "Disabled",
							Value: "disabled",
						},
						{
							Name:  "Confirmed",
							Value: "confirmed",
						},
					},
					Imported: true,
				},
			},
		},
	)

	require.True(t, ActionEqual(a1, a2))
}

func TestCompareUnequalTsEnums(t *testing.T) {
	a1 := createNodeActionWithOptions(
		"User",
		&createActionType{},
		&actionOptions{
			fields: []*field.Field{
				field.NewFieldFromNameAndType("first_name", &enttype.StringType{}),
			},
			tsEnums: []*enum.Enum{
				{
					Name: "AccountStatus",
					Values: []enum.Data{
						{
							Name:  "Deactivated",
							Value: "deactivated",
						},
						{
							Name:  "Disabled",
							Value: "disabled",
						},
						{
							Name:  "Confirmed",
							Value: "confirmed",
						},
					},
					Imported: true,
				},
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
			tsEnums: []*enum.Enum{
				{
					Name: "AccountStatus",
					Values: []enum.Data{
						{
							Name:  "Deactivated",
							Value: "deactivated",
						},
						{
							Name:  "Disabled",
							Value: "disabled",
						},
						{
							Name:  "Verified",
							Value: "verified",
						},
						{
							Name:  "Unverified",
							Value: "unverified",
						},
					},
					Imported: true,
				},
			},
		},
	)

	require.False(t, ActionEqual(a1, a2))
}

func TestCompareGQLEnums(t *testing.T) {
	a1 := createNodeActionWithOptions(
		"User",
		&createActionType{},
		&actionOptions{
			fields: []*field.Field{
				field.NewFieldFromNameAndType("first_name", &enttype.StringType{}),
			},
			gqlEnums: []*enum.GQLEnum{
				{
					Name: "AccountStatus",
					Type: "AccountStatus",
					Values: []enum.Data{
						{
							Name:  "DEACTIVATED",
							Value: "deactivated",
						},
						{
							Name:  "DISABLED",
							Value: "disabled",
						},
						{
							Name:  "CONFIRMED",
							Value: "confirmed",
						},
					},
				},
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
			gqlEnums: []*enum.GQLEnum{
				{
					Name: "AccountStatus",
					Type: "AccountStatus",
					Values: []enum.Data{
						{
							Name:  "DEACTIVATED",
							Value: "deactivated",
						},
						{
							Name:  "DISABLED",
							Value: "disabled",
						},
						{
							Name:  "CONFIRMED",
							Value: "confirmed",
						},
					},
				},
			},
		},
	)

	require.True(t, ActionEqual(a1, a2))
}

func TestCompareUnequalGQLEnums(t *testing.T) {
	a1 := createNodeActionWithOptions(
		"User",
		&createActionType{},
		&actionOptions{
			fields: []*field.Field{
				field.NewFieldFromNameAndType("first_name", &enttype.StringType{}),
			},
			gqlEnums: []*enum.GQLEnum{
				{
					Name: "AccountStatus",
					Type: "AccountStatus",
					Values: []enum.Data{
						{
							Name:  "DEACTIVATED",
							Value: "deactivated",
						},
						{
							Name:  "DISABLED",
							Value: "disabled",
						},
						{
							Name:  "CONFIRMED",
							Value: "confirmed",
						},
					},
				},
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
			gqlEnums: []*enum.GQLEnum{
				{
					Name: "AccountStatus",
					Type: "AccountStatus",
					Values: []enum.Data{
						{
							Name:  "DEACTIVATED",
							Value: "deactivated",
						},
						{
							Name:  "DISABLED",
							Value: "disabled",
						},
						{
							Name:  "UNVERIFIED",
							Value: "unverified",
						},
						{
							Name:  "VERIFIED",
							Value: "verified",
						},
					},
				},
			},
		},
	)

	require.False(t, ActionEqual(a1, a2))
}

// TODO custom interface

// TODO
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
	tsEnums                                              []*enum.Enum
	gqlEnums                                             []*enum.GQLEnum
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
	ci.tsEnums = opt.tsEnums
	ci.gqlEnums = opt.gqlEnums
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
