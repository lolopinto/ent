package action

import (
	"github.com/lolopinto/ent/internal/codegen/nodeinfo"
	"github.com/lolopinto/ent/internal/edge"
	"github.com/lolopinto/ent/internal/field"
	"github.com/lolopinto/ent/internal/schema/change"
	"github.com/lolopinto/ent/internal/schema/custominterface"
	"github.com/lolopinto/ent/internal/schema/enum"
)

func compareCommonActionInfo(action1, action2 commonActionInfo) bool {
	return action1.ActionName == action2.ActionName &&
		action1.ExposeToGraphQL == action2.ExposeToGraphQL &&
		action1.InputName == action2.InputName &&
		action1.GraphQLName == action2.GraphQLName &&
		field.FieldsEqual(action1.Fields, action2.Fields) &&
		field.NonEntFieldsEqual(action1.NonEntFields, action2.NonEntFields) &&
		edge.AssocEdgesEqual(action1.Edges, action2.Edges) &&
		edge.AssocEdgeGroupEqual(action1.EdgeGroup, action1.EdgeGroup) &&
		action1.Operation == action2.Operation &&
		custominterface.CompareInterfacesMapEqual(action1.customInterfaces, action2.customInterfaces) &&
		enum.EnumsEqual(action1.tsEnums, action2.tsEnums) &&
		enum.GQLEnumsEqual(action1.gqlEnums, action2.gqlEnums) &&
		nodeinfo.NodeInfoEqual(action1.NodeInfo, action2.NodeInfo)
}

func ActionEqual(a, a2 Action) bool {
	// everything is implemented by commonActionInfo
	return compareCommonActionInfo(a.getCommonInfo(), a2.getCommonInfo())
}

func compareActionMap(m1, m2 map[string]Action) []change.Change {
	var ret []change.Change
	for k, action1 := range m1 {
		action2, ok := m2[k]
		// in 1st but not 2nd, dropped
		if !ok {
			ret = append(ret, change.Change{
				Change: change.RemoveAction,
				Action: k,
			})
		} else {
			if !ActionEqual(action1, action2) {
				ret = append(ret, change.Change{
					Change: change.ModifyAction,
					Action: k,
				})
			}
		}
	}

	for k := range m2 {
		_, ok := m1[k]
		// in 2nd but not first, added
		if !ok {
			ret = append(ret, change.Change{
				Change: change.AddAction,
				Action: k,
			})
		}
	}
	return ret
}

func CompareActionInfo(a1, a2 *ActionInfo) []change.Change {
	if a1 == nil {
		a1 = &ActionInfo{}
	}
	if a2 == nil {
		a2 = &ActionInfo{}
	}
	return compareActionMap(a1.actionMap, a2.actionMap)
}
