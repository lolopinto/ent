package kv_test

import (
	"testing"

	"github.com/lolopinto/ent/internal/codepath"
	"github.com/lolopinto/ent/internal/kv"
	"github.com/stretchr/testify/require"
)

func TestBaseObject(t *testing.T) {
	o := kv.NewObjectFromPairs(
		kv.Pair{
			Key:   "key1",
			Value: "value1",
		},
		kv.Pair{
			Key:   "key2",
			Value: "value2",
			Import: &kv.Import{
				ImportPath: codepath.SchemaPackage,
				Import:     "ActionOperation",
			},
		},
		kv.Pair{
			Key:   "key3",
			Value: "value3",
		},
	)

	imps := o.GetImports()
	require.Len(t, imps, 1)
	require.Equal(t, imps[0], &kv.Import{
		ImportPath: codepath.SchemaPackage,
		Import:     "ActionOperation",
	})

	require.Equal(t, o.String(), "{key1: value1, key2: value2, key3: value3}")
}

func getList() *kv.List {
	o1 := kv.NewObjectFromPairs(
		kv.Pair{
			Key:   "key1",
			Value: "value1",
		},
		kv.Pair{
			Key:   "key2",
			Value: "value2",
			Import: &kv.Import{
				ImportPath: codepath.SchemaPackage,
				Import:     "ActionOperation",
			},
		},
		kv.Pair{
			Key:   "key3",
			Value: "value3",
		},
	)
	o2 := kv.NewObjectFromPairs(kv.Pair{
		Key:   "col1",
		Value: "val1",
	})
	l := &kv.List{}
	l.Append(o1, o2)
	return l
}

func TestList(t *testing.T) {
	l := getList()

	require.Equal(t, l.Len(), 2)
	imps := l.GetImports()
	require.Len(t, imps, 1)
	require.Equal(t, imps[0], &kv.Import{
		ImportPath: codepath.SchemaPackage,
		Import:     "ActionOperation",
	})

	require.Equal(t, l.String(), "[{key1: value1, key2: value2, key3: value3}, {col1: val1}]")
}

func TestNestedObject(t *testing.T) {
	l := getList()

	o := kv.Object{}
	o.AppendList("list", *l)
	imps := l.GetImports()
	require.Len(t, imps, 1)
	require.Equal(t, imps[0], &kv.Import{
		ImportPath: codepath.SchemaPackage,
		Import:     "ActionOperation",
	})
	require.Equal(t, o.String(), "{list: [{key1: value1, key2: value2, key3: value3}, {col1: val1}]}")
}

func TestListItem(t *testing.T) {
	li := &kv.ListItem{
		Items: []string{
			"one",
			"two",
			"three",
			"four",
		},
	}
	require.Equal(t, li.String(), "[one, two, three, four]")
}
