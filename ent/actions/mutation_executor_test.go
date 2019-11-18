package actions

import (
	"testing"

	"github.com/lolopinto/ent/ent"
	"github.com/stretchr/testify/assert"
)

func TestEmptyList(t *testing.T) {
	exec := newListBasedExec([]string{}, "")
	result, err := execOperations(exec)
	assert.Nil(t, err)
	assert.Len(t, result, 0)
	var expectedResult []string
	// don't know other way of getting zero value of this
	assert.Equal(t, expectedResult, result)
}

func TestListBased(t *testing.T) {
	testCases := []string{
		"12324323",
		"1",
		"2",
		"3",
	}
	for _, placeholderID := range testCases {
		exec := newListBasedExec([]string{"1", "2", "3"}, placeholderID)
		result, err := execOperations(exec)
		assert.Nil(t, err)
		assert.Len(t, result, 3)
		assert.Equal(t, []string{"1", "2", "3"}, result)

		// no ent was created so ResolveValue() returns nil for random placeholderID or
		// placeholderID that matches id
		assert.Nil(t, exec.ResolveValue("1"))
		assert.Nil(t, exec.ResolveValue("2"))
		assert.Nil(t, exec.ResolveValue("3"))
	}
}

func TestListBasedCreatedEnt(t *testing.T) {
	exec := newListBasedExec([]string{"ent1", "2", "3"}, "1")

	result, err := execOperations(exec)
	assert.Nil(t, err)
	assert.Len(t, result, 3)
	assert.Equal(t, []string{"1", "2", "3"}, result)

	// ResolveValue returns something when an ent is created and value matches the placeholderID
	assert.NotNil(t, exec.ResolveValue("1"))
	assert.Nil(t, exec.ResolveValue("2"))
	assert.Nil(t, exec.ResolveValue("3"))
}

func TestListBasedWithDependencies(t *testing.T) {
	op := simpleOpWithEnt{}
	op.id = "1"

	resolvableOp := &resolvableSimpleOp{}
	resolvableOp.id = "3"
	resolvableOp.placeholderID = "15"

	ops := []ent.DataOperation{
		op,
		simpleOp{"2"},
		resolvableOp,
	}
	exec := &entListBasedExecutor{
		placeholderID: resolvableOp.placeholderID,
		ops:           ops,
	}

	result, err := execOperations(exec)
	assert.Nil(t, err)
	assert.Len(t, result, 3)
	// ResolveValue was called and we updated the placeholder correctly and GetID() of resolved object was called
	assert.Equal(t, []string{"1", "2", "1 3"}, result)

	// ResolveValue returns something when an ent is created and value matches the placeholderID
	assert.Nil(t, exec.ResolveValue("1"))
	assert.Nil(t, exec.ResolveValue("2"))
	assert.Nil(t, exec.ResolveValue("3"))
	assert.NotNil(t, exec.ResolveValue("15"))
}

func TestSingleListDependency(t *testing.T) {
	testCases := []string{
		"12324323",
		"1",
		"2",
		"3",
	}
	for _, placeholderID := range testCases {
		changeset := newChangesetWithListBasedExec([]string{"1", "2", "3"}, placeholderID)

		exec := &entWithDependenciesExecutor{
			// this needs to be a different placeholder...
			placeholderID: "2323",
			ops: []ent.DataOperation{
				simpleOp{"4"},
				simpleOp{"5"},
			},
			changesets: []ent.Changeset{changeset},
		}

		result, err := execOperations(exec)
		assert.Nil(t, err)
		assert.Len(t, result, 5)
		assert.Equal(t, []string{"4", "5", "1", "2", "3"}, result)

		// no ent was created so ResolveValue() returns nil for random placeholderID or
		// placeholderID that matches id

		// ResolveValue returns something when an ent is created and value matches the placeholderID
		assert.Nil(t, exec.ResolveValue("1"))
		assert.Nil(t, exec.ResolveValue("2"))
		assert.Nil(t, exec.ResolveValue("3"))
		assert.Nil(t, exec.ResolveValue("4"))
		assert.Nil(t, exec.ResolveValue("5"))
	}
}

func TestMultiListDependency(t *testing.T) {
	testCases := []string{
		"12324323",
		"1",
		"2",
		"3",
	}
	for _, placeholderID := range testCases {
		changeset1 := newChangesetWithListBasedExec([]string{"1", "2", "3"}, placeholderID)
		changeset2 := newChangesetWithListBasedExec([]string{"4", "5", "6"}, placeholderID)

		exec := &entWithDependenciesExecutor{
			// this needs to be a different placeholder...
			placeholderID: "2323",
			ops: []ent.DataOperation{
				simpleOp{"7"},
				simpleOp{"8"},
			},
			changesets: []ent.Changeset{changeset1, changeset2},
		}

		result, err := execOperations(exec)
		assert.Nil(t, err)
		assert.Len(t, result, 8)
		assert.Equal(t, []string{"7", "8", "1", "2", "3", "4", "5", "6"}, result)

		// no ent was created so ResolveValue() returns nil for random placeholderID or
		// placeholderID that matches id

		// ResolveValue returns something when an ent is created and value matches the placeholderID
		assert.Nil(t, exec.ResolveValue("1"))
		assert.Nil(t, exec.ResolveValue("2"))
		assert.Nil(t, exec.ResolveValue("3"))
		assert.Nil(t, exec.ResolveValue("4"))
		assert.Nil(t, exec.ResolveValue("5"))
		assert.Nil(t, exec.ResolveValue("6"))
		assert.Nil(t, exec.ResolveValue("7"))
		assert.Nil(t, exec.ResolveValue("8"))
	}
}

func TestMultiListDependencyCreatedEnt(t *testing.T) {
	changeset1 := newChangesetWithListBasedExec([]string{"ent1", "2", "3"}, "1")
	changeset2 := newChangesetWithListBasedExec([]string{"ent4", "5", "6"}, "4")

	op := simpleOpWithEnt{}
	op.id = "7"
	exec := &entWithDependenciesExecutor{
		// this needs to be a different placeholder...
		placeholderID: "7",
		ops: []ent.DataOperation{
			op,
			simpleOp{"8"},
		},
		changesets: []ent.Changeset{changeset1, changeset2},
	}

	result, err := execOperations(exec)
	assert.Nil(t, err)
	assert.Len(t, result, 8)
	assert.Equal(t, []string{"7", "8", "1", "2", "3", "4", "5", "6"}, result)

	// ent was created and created ent matches placeholder for 1,4,7

	// ResolveValue returns something when an ent is created and value matches the placeholderID
	assert.NotNil(t, exec.ResolveValue("1"))
	assert.Nil(t, exec.ResolveValue("2"))
	assert.Nil(t, exec.ResolveValue("3"))
	assert.NotNil(t, exec.ResolveValue("4"))
	assert.Nil(t, exec.ResolveValue("5"))
	assert.Nil(t, exec.ResolveValue("6"))
	assert.NotNil(t, exec.ResolveValue("7"))
	assert.Nil(t, exec.ResolveValue("8"))
}

func TestMultiLevelDependency(t *testing.T) {
	changeset1 := newChangesetWithListBasedExec([]string{"ent1", "2", "3"}, "1")
	changeset2 := newChangesetWithListBasedExec([]string{"ent4", "5", "6"}, "4")

	op := simpleOpWithEnt{}
	op.id = "7"
	innerExec := &entWithDependenciesExecutor{
		// this needs to be a different placeholder...
		placeholderID: "7",
		ops: []ent.DataOperation{
			op,
			simpleOp{"8"},
		},
		changesets: []ent.Changeset{changeset1, changeset2},
	}
	innerChangeset := newChangesetFromExec(innerExec.placeholderID, innerExec)

	op2 := simpleOpWithEnt{}
	op2.id = "9"
	outerExec := &entWithDependenciesExecutor{
		placeholderID: "9",
		ops: []ent.DataOperation{
			op2,
			simpleOp{"10"},
		},
		changesets: []ent.Changeset{innerChangeset},
	}

	outerChangeset := newChangesetFromExec(outerExec.placeholderID, outerExec)

	op3 := simpleOpWithEnt{}
	op3.id = "11"
	outerOuterExec := &entWithDependenciesExecutor{
		placeholderID: "11",
		ops: []ent.DataOperation{
			op3,
			simpleOp{"12"},
			simpleOp{"13"},
		},
		changesets: []ent.Changeset{outerChangeset},
	}

	result, err := execOperations(outerOuterExec)
	assert.Nil(t, err)
	assert.Len(t, result, 13)
	assert.Equal(t, []string{"11", "12", "13", "9", "10", "7", "8", "1", "2", "3", "4", "5", "6"}, result)

	// ent was created and created ent matches placeholder for 1, 4, 7, 9, 11

	// ResolveValue returns something when an ent is created and value matches the placeholderID
	assert.NotNil(t, outerOuterExec.ResolveValue("1"))
	assert.Nil(t, outerOuterExec.ResolveValue("2"))
	assert.Nil(t, outerOuterExec.ResolveValue("3"))
	assert.NotNil(t, outerOuterExec.ResolveValue("4"))
	assert.Nil(t, outerOuterExec.ResolveValue("5"))
	assert.Nil(t, outerOuterExec.ResolveValue("6"))
	assert.NotNil(t, outerOuterExec.ResolveValue("7"))
	assert.Nil(t, outerOuterExec.ResolveValue("8"))
	assert.NotNil(t, outerOuterExec.ResolveValue("9"))
	assert.Nil(t, outerOuterExec.ResolveValue("10"))
	assert.NotNil(t, outerOuterExec.ResolveValue("11"))
	assert.Nil(t, outerOuterExec.ResolveValue("12"))
	assert.Nil(t, outerOuterExec.ResolveValue("13"))
}

func TestBuilderDependency(t *testing.T) {
	builder := getBuilder()
	changeset := newChangesetWithListBasedExec([]string{"ent1", "2", "3"}, builder.GetPlaceholderID())

	resolvableOp := &resolvableSimpleOp{}
	resolvableOp.placeholderID = builder.GetPlaceholderID()
	resolvableOp.id = "4"

	exec := &entWithDependenciesExecutor{
		// this needs to be a different placeholder...
		placeholderID: "2323",
		ops: []ent.DataOperation{
			resolvableOp,
			simpleOp{"5"},
		},
		changesets: []ent.Changeset{changeset},
		dependencies: ent.MutationBuilderMap{
			builder.GetPlaceholderID(): builder,
		},
	}

	result, err := execOperations(exec)
	assert.Nil(t, err)
	assert.Len(t, result, 5)
	// 1, 2, 3 done first
	// ResolveValue was called and we updated the placeholder correctly and GetID() of resolved object was called
	// 4 next with entID of 1 involved, then 5
	assert.Equal(t, []string{"1", "2", "3", "1 4", "5"}, result)

	// ent was created so ResolveValue() returns nil for everything but builder.GetPlaceholderID()
	assert.Nil(t, exec.ResolveValue("1"))
	assert.Nil(t, exec.ResolveValue("2"))
	assert.Nil(t, exec.ResolveValue("3"))
	assert.Nil(t, exec.ResolveValue("4"))
	assert.Nil(t, exec.ResolveValue("5"))
	assert.NotNil(t, exec.ResolveValue(builder.GetPlaceholderID()))
}

func TestMultiLevelBuilderDependency(t *testing.T) {
	builder := getBuilder()

	// 1 creates an ent, 2-6 don't
	// anything that depends on this changeset gets 1 back
	changeset1 := newChangesetWithListBasedExec([]string{"ent1", "2", "3"}, builder.GetPlaceholderID())
	changeset2 := newChangesetWithListBasedExec([]string{"4", "5", "6"}, "4")

	// 7 creates an ent and something is going to depend on it later
	opWithEnt := simpleOpWithEnt{}
	opWithEnt.id = "7"

	// resolvableOp depends on builder so output should be "1 8"
	resolvableOp := &resolvableSimpleOp{}
	resolvableOp.placeholderID = builder.GetPlaceholderID()
	resolvableOp.id = "8"

	// anything that depends on this changeset gets 8 back
	builder2 := getBuilder()

	innerExec := &entWithDependenciesExecutor{
		// this needs to be a different placeholder...
		placeholderID: builder2.GetPlaceholderID(),
		ops: []ent.DataOperation{
			opWithEnt,
			resolvableOp,
		},
		changesets: []ent.Changeset{changeset1, changeset2},
		dependencies: ent.MutationBuilderMap{
			builder.GetPlaceholderID(): builder,
		},
	}
	innerChangeset := newChangesetFromExec(innerExec.placeholderID, innerExec)

	// resolvableOp2 depends on builder2 so output should be "7 9"
	// 7 is what's created by that changeset
	resolvableOp2 := &resolvableSimpleOp{}
	resolvableOp2.placeholderID = builder2.GetPlaceholderID()
	resolvableOp2.id = "9"

	outerExec := &entWithDependenciesExecutor{
		// this needs to be a different placeholder...
		placeholderID: "12132",
		ops: []ent.DataOperation{
			resolvableOp2,
			simpleOp{"10"},
			simpleOp{"11"},
		},
		changesets: []ent.Changeset{innerChangeset},
		dependencies: ent.MutationBuilderMap{
			builder2.GetPlaceholderID(): builder2,
		},
	}

	result, err := execOperations(outerExec)
	assert.Nil(t, err)
	assert.Len(t, result, 11)
	// order of operations: things we depend on, self, other changesets
	// changesets are [1, 2, 3], [4, 5, 6], [7, 8], [9, 10, 11]
	// [9, 10, 11] depends on [7, 8] which depends on [1, 2, 3], [4, 5, 6]
	// so we end up with 9 depending on 7 which depends on 1 which means:
	// [1, 2, 3] is done first then [7, 8] (self) at that point. 8 becomes "1 8" because that's the created ent
	// then [4, 5, 6] to finish the [7, 8] changeset
	// then [9, 10, 11] which outputs "7 9" since it depends on that.
	assert.Equal(t, []string{"1", "2", "3", "7", "1 8", "4", "5", "6", "7 9", "10", "11"}, result)

	// multiple ents created so ResolveValue() returns nil for everything but builder[2].GetPlaceholderID()
	assert.Nil(t, outerExec.ResolveValue("1"))
	assert.Nil(t, outerExec.ResolveValue("2"))
	assert.Nil(t, outerExec.ResolveValue("3"))
	assert.Nil(t, outerExec.ResolveValue("4"))
	assert.Nil(t, outerExec.ResolveValue("5"))
	assert.Nil(t, outerExec.ResolveValue("6"))
	assert.Nil(t, outerExec.ResolveValue("7"))
	assert.Nil(t, outerExec.ResolveValue("8"))
	assert.Nil(t, outerExec.ResolveValue("9"))
	assert.Nil(t, outerExec.ResolveValue("10"))
	assert.Nil(t, outerExec.ResolveValue("11"))

	assert.NotNil(t, outerExec.ResolveValue(builder.GetPlaceholderID()))
	assert.NotNil(t, outerExec.ResolveValue(builder2.GetPlaceholderID()))
}
