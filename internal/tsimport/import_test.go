package tsimport_test

import (
	"strconv"
	"strings"
	"testing"

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

func getLine(line, path string) string {
	r := strings.NewReplacer("{path}", strconv.Quote(path))
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
				reserveImport(imps, "ent/ent", "loadEnt", "loadEntX", "Viewer")

				useImport(imps, "loadEnt")
				useImport(imps, "loadEntX")
			},
			expectedLines: []string{
				getLine("import {loadEnt, loadEntX} from {path};", "ent/ent"),
			},
		},
		"nothing used": {
			fn: func(imps *tsimport.Imports) {
				reserveImport(imps, "ent/ent", "loadEnt", "loadEntX", "Viewer")
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
				reserveAllImport(imps, "ent/query", "query")

				useImport(imps, "query")
			},
			expectedLines: []string{
				getLine("import * as query from {path};", "ent/query"),
			},
		},
		"reserve all. not used": {
			fn: func(imps *tsimport.Imports) {
				reserveAllImport(imps, "ent/query", "query")
			},
			expectedLines: []string{},
		},
		// TODO name collisions foo as bar
		// simpler version of * as query?
		"reserve same thing multiple times": {
			fn: func(imps *tsimport.Imports) {
				reserveAllImport(imps, "ent/query", "query")
				reserveAllImport(imps, "bar/foo", "query")
			},
			panicInFn: true,
		},
		"use not reserved": {
			fn: func(imps *tsimport.Imports) {
				useImport(imps, "query")
			},
			panicInFn: true,
		},
		"use multiple times": {
			fn: func(imps *tsimport.Imports) {
				reserveAllImport(imps, "ent/query", "query")

				useImport(imps, "query")
				useImport(imps, "query")
			},
			expectedLines: []string{
				getLine("import * as query from {path};", "ent/query"),
			},
		},
		"combo": {
			fn: func(imps *tsimport.Imports) {
				reserveImport(imps, "ent/ent", "loadEnt", "loadEntX", "Viewer", "ID")
				reserveDefaultImport(imps, "src/ent/user", "User", "createUser", "editUser")
				reserveDefaultImport(imps, "src/ent/contact", "Contact", "createContact", "editContact")

				reserveAllImport(imps, "ent/query", "query")

				useImport(imps, "ID")
				useImport(imps, "loadEnt")
				useImport(imps, "loadEntX")

				useImport(imps, "User")
				useImport(imps, "editUser")
				useImport(imps, "query")
			},
			expectedLines: []string{
				getLine("import {loadEnt, loadEntX, ID} from {path};", "ent/ent"),
				getLine("import User, {editUser} from {path};", "src/ent/user"),
				getLine("import * as query from {path};", "ent/query"),
			},
		},
		"reserve separately": {
			fn: func(imps *tsimport.Imports) {
				reserveImport(imps, "ent/ent", "loadEnt")
				reserveImport(imps, "ent/ent", "ID")

				useImport(imps, "ID")
				useImport(imps, "loadEnt")
			},
			expectedLines: []string{
				getLine("import {loadEnt, ID} from {path};", "ent/ent"),
			},
		},
		"reserve default separately": {
			fn: func(imps *tsimport.Imports) {
				reserveDefaultImport(imps, "src/ent/user", "User")
				reserveImport(imps, "src/ent/user", "createUser", "editUser")

				reserveImport(imps, "ent/ent", "loadEnt")
				reserveImport(imps, "ent/ent", "ID")

				useImport(imps, "ID")
				useImport(imps, "loadEnt")
				useImport(imps, "User")
				useImport(imps, "createUser")
			},
			expectedLines: []string{
				getLine("import User, {createUser} from {path};", "src/ent/user"),
				getLine("import {loadEnt, ID} from {path};", "ent/ent"),
			},
		},
		"reserve default import after import": {
			fn: func(imps *tsimport.Imports) {
				reserveImport(imps, "src/ent/user", "createUser", "editUser")
				reserveDefaultImport(imps, "src/ent/user", "User")

				reserveImport(imps, "ent/ent", "loadEnt")
				reserveImport(imps, "ent/ent", "ID")

				useImport(imps, "ID")
				useImport(imps, "loadEnt")
				useImport(imps, "User")
				useImport(imps, "createUser")
			},
			expectedLines: []string{
				getLine("import User, {createUser} from {path};", "src/ent/user"),
				getLine("import {loadEnt, ID} from {path};", "ent/ent"),
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
				getLine("export {foo, bar} from {path};", "src/ent/const"),
			},
		},
		"import + export": {
			fn: func(imps *tsimport.Imports) {
				reserveImport(imps, "ent/ent", "loadEnt", "loadEntX", "Viewer")

				useImport(imps, "loadEnt")
				useImport(imps, "loadEntX")
				export(imps, "src/ent/const", "foo", "bar")
			},
			expectedLines: []string{
				// export first regardless of order
				getLine("export {foo, bar} from {path};", "src/ent/const"),
				getLine("import {loadEnt, loadEntX} from {path};", "ent/ent"),
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
