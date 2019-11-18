package actions

import (
	"testing"

	"github.com/lolopinto/ent/ent"
	"github.com/stretchr/testify/assert"
)

func TestMultiChangesetNoChangeset(t *testing.T) {
	c, err := MultiChangesets(func() (ent.Changeset, error) {
		return nil, nil
	})
	assert.Nil(t, err)
	assert.Nil(t, c)
}

func TestMultiChangesetOneChangeset(t *testing.T) {
	c := newChangesetWithListBasedExec([]string{"1", "2", "3"}, "1")
	c2, err := MultiChangesets(func() (ent.Changeset, error) {
		return c, nil
	})
	assert.Nil(t, err)
	assert.NotNil(t, c2)
	assert.Equal(t, c, c2)

	result, err := execOperations(c2.GetExecutor())
	assert.Nil(t, err)
	assert.Len(t, result, 3)
	assert.Equal(t, []string{"1", "2", "3"}, result)
}

func TestMultiChangesetMultipleChangesets(t *testing.T) {
	c := newChangesetWithListBasedExec([]string{"1", "2", "3"}, "1")
	c2 := newChangesetWithListBasedExec([]string{"4", "5", "6"}, "4")

	c3, err := MultiChangesets(
		func() (ent.Changeset, error) {
			return c, nil
		},
		func() (ent.Changeset, error) {
			return c2, nil
		},
	)
	assert.Nil(t, err)
	assert.NotEqual(t, c, c3)
	assert.NotEqual(t, c2, c3)

	result, err := execOperations(c3.GetExecutor())
	assert.Nil(t, err)
	assert.NotNil(t, c3)
	assert.Len(t, result, 6)
	// order doesn't matter here so can't confirm order
	assert.ElementsMatch(t, []string{"1", "2", "3", "4", "5", "6"}, result)
}

func TestMultiChangesetChangesetChain(t *testing.T) {
	c1 := newListBasedChangeset([]string{"1", "2", "3"}, "1")
	c2 := newListBasedChangeset([]string{"4", "5", "6"}, "4")
	c3 := newListBasedChangeset([]string{"7", "8", "9"}, "7")
	// explicitly append changeset here
	c1.changesets = append(c1.changesets, c3)

	c4, err := MultiChangesets(
		func() (ent.Changeset, error) {
			return c1, nil
		},
		func() (ent.Changeset, error) {
			return c2, nil
		},
	)
	assert.Nil(t, err)
	assert.NotNil(t, c4)
	assert.NotEqual(t, c1, c4)
	assert.NotEqual(t, c2, c4)
	assert.NotEqual(t, c3, c4)

	result, err := execOperations(c4.GetExecutor())
	assert.Nil(t, err)
	assert.Len(t, result, 9)
	// order doesn't matter here so can't confirm order
	assert.ElementsMatch(t, []string{"1", "2", "3", "4", "5", "6", "7", "8", "9"}, result)
}

func TestChangesetWithDependency(t *testing.T) {
	builder := getBuilder()
	c1 := newChangesetWithListBasedExec([]string{"ent1", "2", "3"}, builder.GetPlaceholderID())

	resolvableOp := &resolvableSimpleOp{}
	resolvableOp.placeholderID = builder.GetPlaceholderID()
	resolvableOp.id = "4"

	c2 := newChangesetFromOps("2323", []ent.DataOperation{
		resolvableOp,
		simpleOp{"5"},
	})
	c2.dependencies = ent.MutationBuilderMap{
		builder.GetPlaceholderID(): builder,
	}

	c3, err := MultiChangesets(
		func() (ent.Changeset, error) {
			return c1, nil
		},
		func() (ent.Changeset, error) {
			return c2, nil
		},
	)
	assert.Nil(t, err)
	assert.NotNil(t, c3)
	assert.NotEqual(t, c1, c3)
	assert.NotEqual(t, c2, c3)

	result, err := execOperations(c3.GetExecutor())
	assert.Nil(t, err)
	assert.Len(t, result, 5)
	// order matters here since explicit dependency
	assert.Equal(t, []string{"1", "2", "3", "1 4", "5"}, result)
}

func TestComplicatedNestedChangeset(t *testing.T) {
	c1 := newListBasedChangeset([]string{"1", "2", "3"}, "1")
	c2 := newListBasedChangeset([]string{"4", "5", "6"}, "4")

	builder := getBuilder()
	c3 := newListBasedChangeset([]string{"ent7", "8", "9"}, builder.GetPlaceholderID())
	c3.changesets = append(c3.changesets, c1, c2)

	opWithEnt := simpleOpWithEnt{}
	opWithEnt.id = "10"

	resolvableOp := &resolvableSimpleOp{}
	resolvableOp.placeholderID = builder.GetPlaceholderID()
	resolvableOp.id = "11"

	builder2 := getBuilder()

	c4 := newChangesetFromOps(builder2.GetPlaceholderID(), []ent.DataOperation{
		// NOTE: when combined, it only apparently works when the opWithEnt comes before the resolvable ent
		opWithEnt,
		resolvableOp,
	})
	c4.dependencies = ent.MutationBuilderMap{
		builder.GetPlaceholderID(): builder,
	}

	resolvableOp2 := &resolvableSimpleOp{}
	resolvableOp2.placeholderID = builder2.GetPlaceholderID()
	resolvableOp2.id = "12"

	c5 := newChangesetFromOps("12524", []ent.DataOperation{
		resolvableOp2,
		simpleOp{"13"},
		simpleOp{"14"},
	})
	c5.dependencies = ent.MutationBuilderMap{
		builder2.GetPlaceholderID(): builder2,
	}

	c6, err := MultiChangesets(
		func() (ent.Changeset, error) {
			return c3, nil
		},
		func() (ent.Changeset, error) {
			return c4, nil
		},
		func() (ent.Changeset, error) {
			return c5, nil
		},
	)
	assert.Nil(t, err)
	assert.NotNil(t, c6)
	assert.NotEqual(t, c1, c6)
	assert.NotEqual(t, c2, c6)
	assert.NotEqual(t, c3, c6)
	assert.NotEqual(t, c4, c6)
	assert.NotEqual(t, c5, c6)

	result, err := execOperations(c6.GetExecutor())
	assert.Nil(t, err)
	assert.Len(t, result, 14)
	// order matters here since explicit nested dependencies
	assert.Equal(t, []string{"7", "8", "9", "1", "2", "3", "4", "5", "6", "10", "7 11", "10 12", "13", "14"}, result)
}
