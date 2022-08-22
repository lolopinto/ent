package testingutils

import (
	"testing"

	"github.com/lolopinto/ent/ent"
	"github.com/stretchr/testify/assert"
)

func VerifyEdge(t *testing.T, expectedEdge, edge *ent.AssocEdge) {
	assert.Equal(t, expectedEdge.EdgeType, edge.EdgeType)
	assert.Equal(t, expectedEdge.ID1, edge.ID1)
	assert.Equal(t, expectedEdge.ID2, edge.ID2)
	assert.Equal(t, expectedEdge.ID1Type, edge.ID1Type)
	assert.Equal(t, expectedEdge.ID2Type, edge.ID2Type)
	assert.Equal(t, expectedEdge.Data, edge.Data)
	assert.NotNil(t, edge.Time)
}
