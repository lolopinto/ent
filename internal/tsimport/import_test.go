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

func getImportLine(line, path string) string {
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

func TestImports(t *testing.T) {
	testCases := map[string]testCase{
		"reserve some": {
			fn: func(imps *tsimport.Imports) {
				reserveImport(imps, "ent/ent", "loadEnt", "loadEntX", "Viewer")

				useImport(imps, "loadEnt")
				useImport(imps, "loadEntX")
			},
			expectedLines: []string{
				getImportLine("import {loadEnt, loadEntX} from {path};", "ent/ent"),
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
				getImportLine("import User from {path};", "src/ent/user"),
			},
		},
		"reserve default. non-default used": {
			fn: func(imps *tsimport.Imports) {
				reserveDefaultImport(imps, "src/ent/user", "User", "createUser", "editUser")

				useImport(imps, "createUser")
				useImport(imps, "editUser")
			},
			expectedLines: []string{
				getImportLine("import {createUser, editUser} from {path};", "src/ent/user"),
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
				getImportLine("import User, {createUser, editUser} from {path};", "src/ent/user"),
			},
		},
		"reserve all. used": {
			fn: func(imps *tsimport.Imports) {
				reserveAllImport(imps, "ent/query", "query")

				useImport(imps, "query")
			},
			expectedLines: []string{
				getImportLine("import * as query from {path};", "ent/query"),
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
				getImportLine("import * as query from {path};", "ent/query"),
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
				getImportLine("import {loadEnt, loadEntX, ID} from {path};", "ent/ent"),
				getImportLine("import User, {editUser} from {path};", "src/ent/user"),
				getImportLine("import * as query from {path};", "ent/query"),
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
				getImportLine("import {loadEnt, ID} from {path};", "ent/ent"),
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
				getImportLine("import User, {createUser} from {path};", "src/ent/user"),
				getImportLine("import {loadEnt, ID} from {path};", "ent/ent"),
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
				getImportLine("import User, {createUser} from {path};", "src/ent/user"),
				getImportLine("import {loadEnt, ID} from {path};", "ent/ent"),
			},
		},
		"reserve exact same thing": {
			fn: func(imps *tsimport.Imports) {
				reserveDefaultImport(imps, "src/ent/user", "User")
				reserveDefaultImport(imps, "src/ent/user", "User")

				useImport(imps, "User")
			},
			expectedLines: []string{
				getImportLine("import User from {path};", "src/ent/user"),
			},
		},
		"reserve different paths": {
			fn: func(imps *tsimport.Imports) {
				reserveDefaultImport(imps, "src/ent/user", "User")
				reserveDefaultImport(imps, "/user", "User")
			},
			panicInFn: true,
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
