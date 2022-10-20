package action

import (
	"github.com/lolopinto/ent/internal/codegen/nodeinfo"
	"github.com/lolopinto/ent/internal/edge"
	"github.com/lolopinto/ent/internal/field"
	"github.com/lolopinto/ent/internal/schema/change"
	"github.com/lolopinto/ent/internal/schema/customtype"
	"github.com/lolopinto/ent/internal/schema/enum"
)

func compareCommonActionInfo(action1, action2 commonActionInfo) bool {
	return action1.ActionName == action2.ActionName &&
		action1.ExposeToGraphQL == action2.ExposeToGraphQL &&
		action1.ActionInputName == action2.ActionInputName &&
		action1.GraphQLInputName == action2.GraphQLInputName &&
		action1.GraphQLName == action2.GraphQLName &&
		field.FieldsEqual(action1.Fields, action2.Fields) &&
		field.NonEntFieldsEqual(action1.NonEntFields, action2.NonEntFields) &&
		edge.AssocEdgesEqual(action1.Edges, action2.Edges) &&
		edge.AssocEdgeGroupEqual(action1.EdgeGroup, action1.EdgeGroup) &&
		action1.Operation == action2.Operation &&
		customtype.CompareInterfacesMapEqual(action1.customInterfaces, action2.customInterfaces) &&
		enum.EnumsEqual(action1.tsEnums, action2.tsEnums) &&
		enum.GQLEnumsEqual(action1.gqlEnums, action2.gqlEnums) &&
		nodeinfo.NodeInfoEqual(action1.NodeInfo, action2.NodeInfo)
}

func ActionEqual(a, a2 Action) bool {
	// everything is implemented by commonActionInfo
	return compareCommonActionInfo(a.getCommonInfo(), a2.getCommonInfo())
}

func compareActionMap(m1, m2 map[string]Action, o *change.CompareOpts) []change.Change {
	var ret []change.Change
	for k, action1 := range m1 {
		action2, ok := m2[k]
		// in 1st but not 2nd, dropped
		if !ok {
			ret = append(ret, change.Change{
				Change:      change.RemoveAction,
				Name:        k,
				GraphQLName: action1.GetGraphQLName(),
			})
		} else {
			if !ActionEqual(action1, action2) {
				// action is different and graphql names changed
				if action1.GetGraphQLName() != action2.GetGraphQLName() {
					// graphql name changed because hidden to graphql is different
					if action1.ExposedToGraphQL() != action2.ExposedToGraphQL() {
						if action2.ExposedToGraphQL() {
							// expose to graphql
							ret = append(
								ret,
								change.Change{
									Change:      change.ModifyAction,
									Name:        k,
									GraphQLName: action1.GetGraphQLName(),
									TSOnly:      true,
								},
								change.Change{
									Change:      change.AddAction,
									GraphQLOnly: true,
									Name:        k,
									GraphQLName: action1.GetGraphQLName(),
								})
						} else {
							// now hidden from graphql
							ret = append(
								ret,
								change.Change{
									Change:      change.ModifyAction,
									Name:        k,
									GraphQLName: action1.GetGraphQLName(),
									TSOnly:      true,
								},
								change.Change{
									Change:      change.RemoveAction,
									GraphQLOnly: true,
									Name:        k,
									GraphQLName: action1.GetGraphQLName(),
								})
						}
					} else {
						ret = append(
							ret,
							change.Change{
								Change:      change.ModifyAction,
								Name:        k,
								GraphQLName: action1.GetGraphQLName(),
								TSOnly:      true,
							},
							change.Change{
								Change:      change.RemoveAction,
								GraphQLOnly: true,
								Name:        k,
								GraphQLName: action1.GetGraphQLName(),
							},
							change.Change{
								Change:      change.AddAction,
								GraphQLOnly: true,
								Name:        k,
								GraphQLName: action2.GetGraphQLName(),
							})
					}
				} else {
					ret = append(ret, change.Change{
						Change:      change.ModifyAction,
						Name:        k,
						GraphQLName: action1.GetGraphQLName(),
					})
				}
			} else {
				if o.AddEqualToGraphQL {
					ret = append(ret, change.Change{
						Change:      change.AddAction,
						Name:        k,
						GraphQLOnly: true,
						GraphQLName: action1.GetGraphQLName(),
					})
				}
				if o.RemoveEqualFromGraphQL {
					ret = append(ret, change.Change{
						Change:      change.RemoveAction,
						Name:        k,
						GraphQLOnly: true,
						GraphQLName: action1.GetGraphQLName(),
					})
				}
			}
		}
	}

	for k, action2 := range m2 {
		_, ok := m1[k]
		// in 2nd but not first, added
		if !ok {
			ret = append(ret, change.Change{
				Change:      change.AddAction,
				Name:        k,
				GraphQLName: action2.GetGraphQLName(),
			})
		}
	}
	return ret
}

func CompareActionInfo(a1, a2 *ActionInfo, opts ...change.CompareOption) []change.Change {
	o := &change.CompareOpts{}
	for _, fn := range opts {
		fn(o)
	}
	if a1 == nil {
		a1 = &ActionInfo{}
	}
	if a2 == nil {
		a2 = &ActionInfo{}
	}
	return compareActionMap(a1.actionMap, a2.actionMap, o)
}
