package actions

import (
	"fmt"

	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/ent/viewer"
	"github.com/lolopinto/ent/internal/depgraph"
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
	observers     []Observer
	validators    []Validator
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

func (c *EntMutationChangeset) Observers() []Observer {
	return c.observers
}

func (c *EntMutationChangeset) Validators() []Validator {
	return c.validators
}

func MultiChangesets(changesetFn ...func() (ent.Changeset, error)) (ent.Changeset, error) {
	changesets, err := runChangesets(changesetFn...)
	if err != nil {
		return nil, err
	}

	// 1 changeset. nothing to do here
	c := changesets[0]
	if len(changesets) == 0 {
		return nil, nil
	} else if len(changesets) == 1 {
		return c, nil
	}

	// check for a dependency graph or anything with dependencies
	var orderedChangesets []ent.Changeset
	changesetsWithDep := make(map[string]ent.ChangesetWithDependencies)
	for _, c := range changesets {
		cWithDep, ok := c.(ent.ChangesetWithDependencies)
		if ok && len(cWithDep.Dependencies()) > 0 {
			changesetsWithDep[cWithDep.GetPlaceholderID()] = cWithDep
		} else {
			// items that have no dependencies can be run in any order
			orderedChangesets = append(orderedChangesets, c)
		}
	}

	// simple case. no dependencies.
	// just return a new changeset that wraps everything...
	if len(changesetsWithDep) == 0 {
		return &EntMutationChangeset{
			viewer: c.GetViewer(),
			entity: c.Entity(),
			// let EntMutationChangeset figure out the executor based on the changesets...
			placeholderID: "",
			entConfig:     c.EntConfig(),
			changesets:    changesets,
		}, nil
	}

	// let's have the dependency graph resolve this...
	g := depgraph.Depgraph{}
	for _, c := range changesetsWithDep {
		var placeholders []string
		for _, dep := range c.Dependencies() {
			// we only care about dependencies in the map
			if _, ok := changesetsWithDep[dep.GetPlaceholderID()]; ok {
				placeholders = append(placeholders, dep.GetPlaceholderID())
			}
		}
		g.AddItem(c.GetPlaceholderID(), c.GetPlaceholderID(), placeholders...)
	}

	// resolve the order of the items with dependencies and add them to the ordered changesets
	if err := g.Run(func(val interface{}) error {
		placeholderID := fmt.Sprintf("%v", val)
		orderedChangesets = append(orderedChangesets, changesetsWithDep[placeholderID])
		return nil
	}); err != nil {
		return nil, err
	}

	// create a new changeset and wrap everything in the right order
	// we use the last item as the "main changeset" for testing purposes so we have access to the right
	// created/modified object. this is really an implementation detail that shouldn't be depended on
	lastChangeset := orderedChangesets[len(orderedChangesets)-1]
	return &EntMutationChangeset{
		viewer: lastChangeset.GetViewer(),
		entity: lastChangeset.Entity(),
		// let EntMutationChangeset figure out the executor based on the changesets...
		//	executor:      c.GetExecutor(),
		placeholderID: "",
		entConfig:     lastChangeset.EntConfig(),
		changesets:    orderedChangesets,
	}, nil
}
