package schema

import (
	"database/sql"
	"fmt"

	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/internal/util"
)

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
	// differentiate between new edges and existing edges for tests
	edgeMap  map[string]*ent.AssocEdgeData
	newEdges []*ent.AssocEdgeData
	// only for tests
	edgesToUpdate []*ent.AssocEdgeData
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
	edgeData.edgeMap[newEdge.EdgeName] = newEdge
}

func (edgeData *assocEdgeData) updateInverseEdgeTypeForEdge(constName string, constValue string) {
	edge := edgeData.edgeMap[constName]
	if edge == nil {
		panic(fmt.Sprintf("couldn't find edge with constName %s", constName))
	}

	ns := &sql.NullString{}
	util.Die(ns.Scan(constValue))
	edge.InverseEdgeType = ns
	edgeData.edgesToUpdate = append(edgeData.edgesToUpdate, edge)
}
