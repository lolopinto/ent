package tsimport

import (
	"testing"

	"github.com/lolopinto/ent/internal/codepath"
	"github.com/stretchr/testify/assert"
)

func TestSortOrder(t *testing.T) {

	assert.True(t, cmp("src/ent/user", "src/graphql/user"))
	assert.False(t, cmp("src/graphql/user", "src/ent/user"))
	assert.True(t, cmp("src/ent/contact", "src/ent/user"))
	assert.True(t, cmp("src/ent/generated/loadAny", "src/ent/internal"))
	assert.True(t, cmp(codepath.Package, "src/ent/internal"))
	assert.True(t, cmp(codepath.Package, codepath.GraphQLPackage))
	assert.False(t, cmp("src/ent/internal", codepath.Package))

	assert.True(t, cmp("src/ent/user", "./auth"))
	assert.False(t, cmp("./auth", "src/ent/user"))
	assert.False(t, cmp("../auth", "src/ent/user"))
	assert.True(t, cmp("src/ent/user", "../auth"))

	assert.True(t, cmp("graphql", "src/ent/user"))
}
