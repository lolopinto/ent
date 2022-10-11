package edge

import "github.com/lolopinto/ent/internal/schemaparser"

func (edge *AssociationEdge) SetCommonEdgeInfo(c commonEdgeInfo) *AssociationEdge {
	edge.commonEdgeInfo = c
	return edge
}

func (edge *AssociationEdge) SetOverridenQueryName(val string) *AssociationEdge {
	edge.overridenQueryName = val
	return edge
}

func (edge *AssociationEdge) SetOverridenGraphQLName(val string) *AssociationEdge {
	edge.overridenGraphQLName = val
	return edge
}

func (edge *AssociationEdge) SetOverridenEdgeName(val string) *AssociationEdge {
	edge.overridenEdgeName = val
	return edge
}

func (edge *AssociationEdge) GetOverridenQueryName() string {
	return edge.overridenQueryName
}

func (edge *AssociationEdge) GetOverridenEdgeName() string {
	return edge.overridenEdgeName
}

func (edge *AssociationEdge) GetOverridenGraphQLName() string {
	return edge.overridenGraphQLName
}

func (edge *AssociationEdge) GetEntConfig() *schemaparser.EntConfigInfo {
	return edge.entConfig
}

func (edge *ForeignKeyEdge) GetDestinationEdge() *destinationEdge {
	return &edge.destinationEdge
}

func (edge *IndexedEdge) GetTsEdgeName() string {
	return edge.tsEdgeName
}

func (edge *IndexedEdge) GetForeignNode() string {
	return edge.foreignNode
}

func (edge *IndexedEdge) GetDestinationEdge() *destinationEdge {
	return &edge.destinationEdge
}

func (edge *InverseAssocEdge) SetCommonEdgeInfo(c commonEdgeInfo) *InverseAssocEdge {
	edge.commonEdgeInfo = c
	return edge
}

func (g *AssociationEdgeGroup) SetStatusEdges(edges []*AssociationEdge) *AssociationEdgeGroup {
	g.statusEdges = edges
	return g
}
