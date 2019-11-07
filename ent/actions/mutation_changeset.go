package actions

import (
	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/ent/viewer"
)

type EntMutationChangeset struct {
	viewer        viewer.ViewerContext
	entity        ent.Entity
	ops           []ent.DataOperation
	executor      ent.Executor
	fields        map[string]interface{}
	placeholderID string
	existingEnt   ent.Entity
	entConfig     ent.Config
	dependencies  ent.MutationBuilderMap
	changesets    []ent.Changeset
}

func (c *EntMutationChangeset) GetExecutor() ent.Executor {
	if c.executor != nil {
		return c.executor
	}
	var executor ent.Executor

	// when you have dependencies but no changesets
	// simple also because something else will handle that
	// so if len(b.changesets) == 0 just be done?
	// the issue is that we need to resolve the underlying dependency
	// which is why we have a list based executor underneath anyways...
	if len(c.changesets) == 0 {
		executor = &entListBasedExecutor{
			placeholderID: c.placeholderID,
			ops:           c.ops,
		}
	} else {
		// dependencies implies other changesets?
		// if not
		// there should either be dependencies or changesets
		executor = &entWithDependenciesExecutor{
			placeholderID: c.placeholderID,
			ops:           c.ops,
			dependencies:  c.dependencies,
			changesets:    c.changesets,
		}
	}
	c.executor = executor
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
