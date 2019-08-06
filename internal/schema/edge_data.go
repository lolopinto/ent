package schema

import (
	"fmt"

	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/internal/util"
)

// func (m NodeMapInfo) hasEdges() bool {
// 	for _, info := range m {
// 		if info.NodeData.EdgeInfo.HasAssociationEdges() {
// 			return true
// 		}
// 	}
// 	return false
// }

func (m NodeMapInfo) loadExistingEdges() *assocEdgeData {
	// load all edges in db
	var existingEdges []*ent.AssocEdgeData
	err := ent.GenLoadAssocEdges(&existingEdges)
	if err != nil {
		fmt.Println("error loading data. assoc_edge_config related", err)
	}
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
