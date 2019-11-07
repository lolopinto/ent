package actions

import "github.com/lolopinto/ent/ent"

func (c *EntMutationChangeset) AddChangeset(changeset ent.Changeset) {
	// provide this in tests to indicate changesets to run together...
	// this depends on executor being defined lazily in EntMutationChangeset
	// since behavior changes depending on changesets
	// needed for TestInboundEdgeBuilder
	c.changesets = append(c.changesets, changeset)
}
