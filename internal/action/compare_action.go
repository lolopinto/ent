package action

import (
	"github.com/lolopinto/ent/internal/codegen/nodeinfo"
	"github.com/lolopinto/ent/internal/edge"
	"github.com/lolopinto/ent/internal/field"
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
