package schema

import (
	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/internal/util"
)

func (m NodeMapInfo) loadExistingEdges() *assocEdgeData {
	// load all edges in db
	var existingEdges []*ent.AssocEdgeData
	err := ent.GenLoadAssocEdges(&existingEdges)
	util.Die(err)

	edgeMap := make(map[string]*ent.AssocEdgeData)
	for _, assocEdgeData := range existingEdges {
		edgeMap[assocEdgeData.EdgeName] = assocEdgeData
	}
	return &assocEdgeData{
		edgeMap: edgeMap,
	}
}

type assocEdgeData struct {
	edgeMap  map[string]*ent.AssocEdgeData
	newEdges []*ent.AssocEdgeData
}

func (edgeData *assocEdgeData) existingEdge(constName string) bool {
	return edgeData.edgeMap[constName] != nil
}

func (edgeData *assocEdgeData) edgeTypeOfEdge(constName string) string {
	if !edgeData.existingEdge(constName) {
		return ""
	}
	return edgeData.edgeMap[constName].EdgeType
}

func (edgeData *assocEdgeData) addNewEdge(newEdge *ent.AssocEdgeData) {
	edgeData.newEdges = append(edgeData.newEdges, newEdge)
}
