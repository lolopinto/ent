package schema

import (
	"database/sql"
	"fmt"

	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/internal/schema/change"
)

type assocEdgeData struct {
	// differentiate between new edges and existing edges for tests
	dbEdgeMap map[string]*ent.AssocEdgeData
	// now that we run upgade before codegen,
	// it should be safe to drop what's not in the schema...
	// so we have 2 different pieces of info. what's in the db and what's seen in the schema
	// and anything not seen in the schema is assumed to be dropped and dropped
	edgesToRender map[string]*ent.AssocEdgeData
	newEdges      []*ent.AssocEdgeData
	// only for tests
	edgesToUpdate []*ent.AssocEdgeData
}

func (edgeData *assocEdgeData) existingEdge(constName string) bool {
	return edgeData.dbEdgeMap[constName] != nil
}

func (edgeData *assocEdgeData) edgeTypeOfEdge(constName string) string {
	if !edgeData.existingEdge(constName) {
		return ""
	}
	return string(edgeData.dbEdgeMap[constName].EdgeType)
}

func (edgeData *assocEdgeData) addNewEdge(newEdge *ent.AssocEdgeData) {
	edgeData.newEdges = append(edgeData.newEdges, newEdge)
	edgeData.dbEdgeMap[newEdge.EdgeName] = newEdge
}

func compareInverseEdgeType(ns1, ns2 *sql.NullString) bool {
	ret := change.CompareNilVals(ns1 == nil, ns2 == nil)
	if ret != nil {
		return *ret
	}
	return ns1.Valid == ns2.Valid &&
		ns1.String == ns2.String
}

func compareEdgeType(edge1, edge2 *ent.AssocEdgeData) bool {
	ret := change.CompareNilVals(edge1 == nil, edge2 == nil)
	if ret != nil {
		return *ret
	}
	return edge1.SymmetricEdge == edge2.SymmetricEdge &&
		edge1.EdgeName == edge2.EdgeName &&
		edge1.EdgeTable == edge2.EdgeTable &&
		edge1.EdgeType == edge2.EdgeType &&
		compareInverseEdgeType(&edge1.InverseEdgeType, &edge2.InverseEdgeType)
}

func (edgeData *assocEdgeData) addEdge(edge *ent.AssocEdgeData, newEdge bool) error {
	if newEdge {
		edgeData.newEdges = append(edgeData.newEdges, edge)
	} else {
		if !compareEdgeType(edgeData.dbEdgeMap[string(edge.EdgeType)], edge) {
			edgeData.edgesToUpdate = append(edgeData.edgesToUpdate, edge)
		}
	}

	if edgeData.edgesToRender[edge.EdgeName] != nil {
		return fmt.Errorf("cannot add edge %s as there's already an edge named that", edge.EdgeName)
	}

	edgeData.edgesToRender[edge.EdgeName] = edge

	return nil
}

// TODO need tests for all these

// * new edges are returned
// * existing edges are returned
// * old edges are removed
func (edgeData *assocEdgeData) getEdgesToRender() map[string]*ent.AssocEdgeData {
	return edgeData.edgesToRender
}
