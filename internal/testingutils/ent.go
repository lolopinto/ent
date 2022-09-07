package testingutils

import (
	"testing"

	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/ent/actions"
	"github.com/lolopinto/ent/ent/viewertesting"
	"github.com/stretchr/testify/assert"
)

func GetBaseBuilder(
	operation ent.WriteOperation,
	loader ent.Loader,
	existingEnt ent.Entity,
) *actions.EntMutationBuilder {
	v := viewertesting.OmniViewerContext{}
	return actions.NewMutationBuilder(v, operation, loader.GetNewInstance().(ent.Entity), loader.GetConfig(), actions.ExistingEnt(existingEnt))
}

func CreateEdge(t *testing.T, edge *ent.AssocEdgeData) {
	b := GetBaseBuilder(
		ent.InsertOperation,
		&ent.AssocEdgeLoader{},
		nil,
	)
	b.SetRawFields(map[string]interface{}{
		"edge_type":         edge.EdgeType,
		"inverse_edge_type": edge.InverseEdgeType,
		"edge_table":        edge.EdgeTable,
		"edge_name":         edge.EdgeName,
		"symmetric_edge":    edge.SymmetricEdge,
	},
	)
	SaveBuilder(t, b)
}

func EditEdge(t *testing.T, edge *ent.AssocEdgeData) {
	b := GetBaseBuilder(
		ent.EditOperation,
		&ent.AssocEdgeLoader{},
		edge,
	)
	b.SetRawFields(map[string]interface{}{
		"edge_type":         edge.EdgeType,
		"inverse_edge_type": edge.InverseEdgeType,
		"edge_table":        edge.EdgeTable,
		"edge_name":         edge.EdgeName,
		"symmetric_edge":    edge.SymmetricEdge,
	})
	SaveBuilder(t, b)
}

func SaveBuilder(t *testing.T, b ent.MutationBuilder) {
	c, err := b.GetChangeset()
	assert.Nil(t, err)
	err = ent.SaveChangeset(c)
	assert.Nil(t, err)
}
