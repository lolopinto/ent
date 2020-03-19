package tsimport_test

import (
	"strconv"
	"strings"
	"testing"

	"github.com/lolopinto/ent/internal/tsimport"
	"github.com/stretchr/testify/assert"
)

type testCase struct {
	fn            func(*tsimport.Imports)
	expectedLines []string
	panicInFn     bool
	panicInStr    bool
}

func getImportLine(line, path string) string {
	r := strings.NewReplacer("{path}", strconv.Quote(path))
	return r.Replace(line)
}

func TestImports(t *testing.T) {
	testCases := map[string]testCase{
		"reserve some": testCase{
			fn: func(imps *tsimport.Imports) {
				imps.Reserve("ent/ent", "loadEnt", "loadEntX", "Viewer")

				imps.Use("loadEnt")
				imps.Use("loadEntX")
			},
			expectedLines: []string{
				getImportLine("import {loadEnt, loadEntX} from {path};", "ent/ent"),
			},
		},
		"nothing used": testCase{
			fn: func(imps *tsimport.Imports) {
				imps.Reserve("ent/ent", "loadEnt", "loadEntX", "Viewer")
			},
			expectedLines: []string{},
		},
		"reserve default. only default used": testCase{
			fn: func(imps *tsimport.Imports) {
				imps.ReserveDefault("src/ent/user", "User", "createUser", "editUser")

				imps.Use("User")
			},
			expectedLines: []string{
				getImportLine("import User from {path};", "src/ent/user"),
			},
		},
		"reserve default. non-default used": testCase{
			fn: func(imps *tsimport.Imports) {
				imps.ReserveDefault("src/ent/user", "User", "createUser", "editUser")

				imps.Use("createUser")
				imps.Use("editUser")
			},
			expectedLines: []string{
				getImportLine("import {createUser, editUser} from {path};", "src/ent/user"),
			},
		},
		"reserve default. mix used": testCase{
			fn: func(imps *tsimport.Imports) {
				imps.ReserveDefault("src/ent/user", "User", "createUser", "editUser")

				imps.Use("createUser")
				imps.Use("editUser")
				imps.Use("User")
			},
			expectedLines: []string{
				getImportLine("import User, {createUser, editUser} from {path};", "src/ent/user"),
			},
		},
		"reserve all. used": testCase{
			fn: func(imps *tsimport.Imports) {
				imps.ReserveAll("ent/query", "query")

				imps.Use("query")
			},
			expectedLines: []string{
				getImportLine("import * as query from {path};", "ent/query"),
			},
		},
		"reserve all. not used": testCase{
			fn: func(imps *tsimport.Imports) {
				imps.ReserveAll("ent/query", "query")
			},
			expectedLines: []string{},
		},
		// TODO name collisions foo as bar
		// simpler version of * as query?
		"reserve same thing multiple times": testCase{
			fn: func(imps *tsimport.Imports) {
				imps.ReserveAll("ent/query", "query")
				imps.ReserveAll("bar/foo", "query")
			},
			panicInFn: true,
		},
		"use not reserved": testCase{
			fn: func(imps *tsimport.Imports) {
				imps.Use("query")
			},
			panicInFn: true,
		},
		"use multiple times": testCase{
			fn: func(imps *tsimport.Imports) {
				imps.ReserveAll("ent/query", "query")

				imps.Use("query")
				imps.Use("query")
			},
			expectedLines: []string{
				getImportLine("import * as query from {path};", "ent/query"),
			},
		},
		"combo": testCase{
			fn: func(imps *tsimport.Imports) {
				imps.Reserve("ent/ent", "loadEnt", "loadEntX", "Viewer", "ID")
				imps.ReserveDefault("src/ent/user", "User", "createUser", "editUser")
				imps.ReserveDefault("src/ent/contact", "Contact", "createContact", "editContact")

				imps.ReserveAll("ent/query", "query")

				imps.Use("ID")
				imps.Use("loadEnt")
				imps.Use("loadEntX")

				imps.Use("User")
				imps.Use("editUser")
				imps.Use("query")
			},
			expectedLines: []string{
				getImportLine("import {loadEnt, loadEntX, ID} from {path};", "ent/ent"),
				getImportLine("import User, {editUser} from {path};", "src/ent/user"),
				getImportLine("import * as query from {path};", "ent/query"),
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
				if tt.panicInStr {
					assert.Len(t, tt.expectedLines, 0)
					assert.Panics(t, func() {
						imps.String()
					})
				} else {
					validateExpectedLines(t, imps, tt.expectedLines)
				}
			}
		})
	}
}

func validateExpectedLines(t *testing.T, imps *tsimport.Imports, lines []string) {
	expLines := strings.Split(imps.String(), "\n")
	// remove last element since it's always nonsense
	expLines = expLines[:len(expLines)-1]

	assert.Equal(t, expLines, lines)
}
