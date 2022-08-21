package schema

import (
	"database/sql"
	"fmt"

	"github.com/lolopinto/ent/ent"
)

type assocEdgeData struct {
	// differentiate between new edges and existing edges for tests
	dbEdgeMap map[string]*ent.AssocEdgeData
	newEdges  []*ent.AssocEdgeData
	// only for tests
	edgesToUpdate []*ent.AssocEdgeData
	seenEdges     map[string]bool
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

func (edgeData *assocEdgeData) updateInverseEdgeTypeForEdge(constName string, constValue string) error {
	edge := edgeData.dbEdgeMap[constName]
	if edge == nil {
		return fmt.Errorf("couldn't find edge with constName %s", constName)
	}

	ns := sql.NullString{}
	if err := ns.Scan(constValue); err != nil {
		return err
	}
	edge.InverseEdgeType = ns
	edgeData.edgesToUpdate = append(edgeData.edgesToUpdate, edge)
	return nil
}

func (edgeData *assocEdgeData) flagSeenEdge(name string) {
	edgeData.seenEdges[name] = true
}

func (edgeData *assocEdgeData) getEdgesToRender() map[string]*ent.AssocEdgeData {
	ret := make(map[string]*ent.AssocEdgeData)

	// now that we run upgade before codegen,
	// it should be safe to drop what's not in the schema...
	for k, v := range edgeData.dbEdgeMap {
		if edgeData.seenEdges[k] {
			ret[k] = v
		}
	}

	// TODO need tests for all these

	// * new edges are returned
	// * existing edges are returned
	// * old edges are removed

	// also make sure new edges are returned..
	for _, v := range edgeData.newEdges {
		ret[v.EdgeName] = v
	}

	return ret
}
