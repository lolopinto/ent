package tsimport_test

import (
	"strconv"
	"strings"
	"testing"

	"github.com/lolopinto/ent/internal/codepath"
	"github.com/lolopinto/ent/internal/tsimport"
	"github.com/lolopinto/ent/internal/util"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type testCase struct {
	fn            func(*tsimport.Imports)
	expectedLines []string
	panicInFn     bool
}

func getLine(line string, paths... string) string {
	path := ""
	if len(paths) > 1 {
		panic("only 1 path supported")
	}
	if len(paths) ==1 {
		path = paths[0]
	}
	r := strings.NewReplacer(
		"{path}", 
		strconv.Quote(path),
		"{root}",
		strconv.Quote(codepath.Package),
		"{graphql}",
		strconv.Quote(codepath.GraphQLPackage),
	)

	return r.Replace(line)
}

func reserveImport(imps *tsimport.Imports, path string, exports ...string) {
	_, err := imps.Reserve(path, exports...)
	util.Die(err)
}

func useImport(imps *tsimport.Imports, export string) {
	_, err := imps.Use(export)
	util.Die(err)
}

func reserveDefaultImport(imps *tsimport.Imports, path, defaultExport string, exports ...string) {
	_, err := imps.ReserveDefault(path, defaultExport, exports...)
	util.Die(err)
}

func reserveAllImport(imps *tsimport.Imports, path, as string) {
	_, err := imps.ReserveAll(path, as)
	util.Die(err)
}

func exportAll(imps *tsimport.Imports, path string) {
	_, err := imps.ExportAll(path)
	util.Die(err)
}

func exportAllAs(imps *tsimport.Imports, path, as string) {
	_, err := imps.ExportAllAs(path, as)
	util.Die(err)
}

func export(imps *tsimport.Imports, path string, exports ...string) {
	_, err := imps.Export(path, exports...)
	util.Die(err)
}

func TestImports(t *testing.T) {
	testCases := map[string]testCase{
		"reserve some": {
			fn: func(imps *tsimport.Imports) {
				reserveImport(imps, codepath.Package, "loadEnt", "loadEntX", "Viewer")

				useImport(imps, "loadEnt")
				useImport(imps, "loadEntX")
			},
			expectedLines: []string{
				getLine("import {loadEnt, loadEntX} from {root};"),
			},
		},
		"nothing used": {
			fn: func(imps *tsimport.Imports) {
				reserveImport(imps, codepath.Package, "loadEnt", "loadEntX", "Viewer")
			},
			expectedLines: []string{},
		},
		"reserve default. only default used": {
			fn: func(imps *tsimport.Imports) {
				reserveDefaultImport(imps, "src/ent/user", "User", "createUser", "editUser")

				useImport(imps, "User")
			},
			expectedLines: []string{
				getLine("import User from {path};", "src/ent/user"),
			},
		},
		"reserve default. non-default used": {
			fn: func(imps *tsimport.Imports) {
				reserveDefaultImport(imps, "src/ent/user", "User", "createUser", "editUser")

				useImport(imps, "createUser")
				useImport(imps, "editUser")
			},
			expectedLines: []string{
				getLine("import {createUser, editUser} from {path};", "src/ent/user"),
			},
		},
		"reserve default. mix used": {
			fn: func(imps *tsimport.Imports) {
				reserveDefaultImport(imps, "src/ent/user", "User", "createUser", "editUser")

				useImport(imps, "createUser")
				useImport(imps, "editUser")
				useImport(imps, "User")
			},
			expectedLines: []string{
				getLine("import User, {createUser, editUser} from {path};", "src/ent/user"),
			},
		},
		"reserve all. used": {
			fn: func(imps *tsimport.Imports) {
				reserveAllImport(imps, "./core/clause", "clause")

				useImport(imps, "clause")
			},
			expectedLines: []string{
				getLine("import * as clause from {path};", "./core/clause"),
			},
		},
		"reserve all. not used": {
			fn: func(imps *tsimport.Imports) {
				reserveAllImport(imps, "./core/clause", "clause")
			},
			expectedLines: []string{},
		},
		// TODO name collisions foo as bar
		// simpler version of * as query?
		"reserve same thing multiple times": {
			fn: func(imps *tsimport.Imports) {
				reserveAllImport(imps, "./core/clause", "clause")
				reserveAllImport(imps, "./core/foo", "clause")
			},
			panicInFn: true,
		},
		"use not reserved": {
			fn: func(imps *tsimport.Imports) {
				useImport(imps, "clause")
			},
			panicInFn: true,
		},
		"use multiple times": {
			fn: func(imps *tsimport.Imports) {
				reserveAllImport(imps, "./core/clause", "clause")

				useImport(imps, "clause")
				useImport(imps, "clause")
			},
			expectedLines: []string{
				getLine("import * as clause from {path};", "./core/clause"),
			},
		},
		"sorted_combo": {
			fn: func(imps *tsimport.Imports) {
				reserveImport(imps, codepath.Package, "loadEnt", "loadEntX", "Viewer", "ID")
				reserveImport(imps, "src/graphql/resolvers/internal", "UserType")
				reserveDefaultImport(imps, "src/ent/user", "User", "createUser", "editUser")
				reserveDefaultImport(imps, "src/ent/contact", "Contact", "createContact", "editContact")
				reserveImport(imps, "graphql", "GraphQLString")
				reserveImport(imps, codepath.GraphQLPackage, "GraphQLTime")

				reserveAllImport(imps, "./core/clause", "clause")

				useImport(imps, "ID")
				useImport(imps, "loadEnt")
				useImport(imps, "loadEntX")

				useImport(imps, "User")
				useImport(imps, "editUser")
				useImport(imps, "clause")
				useImport(imps, "GraphQLString")
				useImport(imps, "GraphQLTime")
				useImport(imps, "UserType")
			},
			expectedLines: []string{
				getLine("import {GraphQLString} from {path};", "graphql"),
				getLine("import {ID, loadEnt, loadEntX} from {root};"),
				getLine("import {GraphQLTime} from {path};", codepath.GraphQLPackage),
				getLine("import User, {editUser} from {path};", "src/ent/user"),
				getLine("import {UserType} from {path};", "src/graphql/resolvers/internal"),
				getLine("import * as clause from {path};", "./core/clause"),
			},
		},
		"reserve separately": {
			fn: func(imps *tsimport.Imports) {
				reserveImport(imps, codepath.Package, "loadEnt")
				reserveImport(imps, codepath.Package, "ID")

				useImport(imps, "ID")
				useImport(imps, "loadEnt")
			},
			expectedLines: []string{
				getLine("import {ID, loadEnt} from {root};"),
			},
		},
		"reserve default separately": {
			fn: func(imps *tsimport.Imports) {
				reserveDefaultImport(imps, "src/ent/user", "User")
				reserveImport(imps, "src/ent/user", "createUser", "editUser")

				reserveImport(imps, codepath.Package, "loadEnt")
				reserveImport(imps, codepath.Package, "ID")

				useImport(imps, "ID")
				useImport(imps, "loadEnt")
				useImport(imps, "User")
				useImport(imps, "createUser")
			},
			expectedLines: []string{
				getLine("import {ID, loadEnt} from {root};"),
				getLine("import User, {createUser} from {path};", "src/ent/user"),
			},
		},
		"reserve default import after import": {
			fn: func(imps *tsimport.Imports) {
				reserveImport(imps, "src/ent/user", "createUser", "editUser")
				reserveDefaultImport(imps, "src/ent/user", "User")

				reserveImport(imps, codepath.Package, "loadEnt")
				reserveImport(imps, codepath.Package, "ID")

				useImport(imps, "ID")
				useImport(imps, "loadEnt")
				useImport(imps, "User")
				useImport(imps, "createUser")
			},
			expectedLines: []string{
				getLine("import {ID, loadEnt} from {path};", codepath.Package),
				getLine("import User, {createUser} from {path};", "src/ent/user"),
			},
		},
		"reserve exact same thing": {
			fn: func(imps *tsimport.Imports) {
				reserveDefaultImport(imps, "src/ent/user", "User")
				reserveDefaultImport(imps, "src/ent/user", "User")

				useImport(imps, "User")
			},
			expectedLines: []string{
				getLine("import User from {path};", "src/ent/user"),
			},
		},
		"reserve different paths": {
			fn: func(imps *tsimport.Imports) {
				reserveDefaultImport(imps, "src/ent/user", "User")
				reserveDefaultImport(imps, "/user", "User")
			},
			panicInFn: true,
		},
		"export all": {
			fn: func(imps *tsimport.Imports) {
				exportAll(imps, "src/ent/const")
			},
			expectedLines: []string{
				getLine("export * from {path};", "src/ent/const"),
			},
		},
		"export all as ": {
			fn: func(imps *tsimport.Imports) {
				exportAllAs(imps, "src/ent/const", "foo")
			},
			expectedLines: []string{
				getLine("export * as foo from {path};", "src/ent/const"),
			},
		},
		"export": {
			fn: func(imps *tsimport.Imports) {
				export(imps, "src/ent/const", "foo", "bar")
			},
			expectedLines: []string{
				getLine("export {bar, foo} from {path};", "src/ent/const"),
			},
		},
		"import + export": {
			fn: func(imps *tsimport.Imports) {
				reserveImport(imps, codepath.Package, "loadEnt", "loadEntX", "Viewer")

				useImport(imps, "loadEntX")
				useImport(imps, "loadEnt")
				export(imps, "src/ent/const", "foo", "bar")
			},
			expectedLines: []string{
				// export first regardless of order
				getLine("export {bar, foo} from {path};", "src/ent/const"),
				getLine("import {loadEnt, loadEntX} from {path};", codepath.Package),
			},
		},
	}

	for key, tt := range testCases {
		t.Run(key, func(t *testing.T) {
			imps := tsimport.NewImports()

			if tt.panicInFn {
				assert.Len(t, tt.expectedLines, 0)
				assert.Panics(t, func() {
					tt.fn(imps)
				})
			} else {
				tt.fn(imps)

				validateExpectedLines(t, imps, tt.expectedLines)
			}
		})
	}
}

func validateExpectedLines(t *testing.T, imps *tsimport.Imports, expLines []string) {
	str, err := imps.String()
	require.Nil(t, err)
	lines := strings.Split(str, "\n")
	// remove last element since it's always nonsense
	lines = lines[:len(lines)-1]

	assert.Equal(t, expLines, lines)
}
