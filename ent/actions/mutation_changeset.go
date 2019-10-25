package actions

import (
	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/ent/viewer"
)

type EntMutationChangeset struct {
	viewer        viewer.ViewerContext
	entity        ent.Entity
	executor      ent.Executor
	fields        map[string]interface{}
	placeholderID string
	existingEnt   ent.Entity
	entConfig     ent.Config
	dependencies  ent.MutationBuilderMap
	changesets    []ent.Changeset
}

func (c *EntMutationChangeset) GetExecutor() ent.Executor {
	return c.executor
}

func (c *EntMutationChangeset) GetPlaceholderID() string {
	return c.placeholderID
}

func (c *EntMutationChangeset) ExistingEnt() ent.Entity {
	return c.existingEnt
}

func (c *EntMutationChangeset) EntConfig() ent.Config {
	return c.entConfig
}

func (c *EntMutationChangeset) GetViewer() viewer.ViewerContext {
	return c.viewer
}

func (c *EntMutationChangeset) Entity() ent.Entity {
	return c.entity
}

func (c *EntMutationChangeset) Dependencies() ent.MutationBuilderMap {
	return c.dependencies
}

func (c *EntMutationChangeset) Changesets() []ent.Changeset {
	return c.changesets
}
