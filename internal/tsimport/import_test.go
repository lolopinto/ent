package tsimport

import (
	"strconv"
	"strings"
	"testing"

	"github.com/lolopinto/ent/internal/codepath"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type testCase struct {
	filePath      string
	fn            func(*Imports)
	expectedLines []string
	errorThrown   bool
	only          bool
	relPaths      bool
	skip          bool
}

func getLine(line string, paths ...string) string {
	path := ""
	if len(paths) > 1 {
		panic("only 1 path supported")
	}
	if len(paths) == 1 {
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

func reserveImport(imps *Imports, path string, exports ...string) error {
	_, err := imps.Reserve(path, exports...)
	return err
}

func useImport(imps *Imports, export string) error {
	_, err := imps.Use(export)
	return err
}

func reserveDefaultImport(imps *Imports, path, defaultExport string, exports ...string) error {
	_, err := imps.ReserveDefault(path, defaultExport, exports...)
	return err
}

func reserveAllImport(imps *Imports, path, as string) error {
	_, err := imps.ReserveAll(path, as)
	return err
}

func exportAll(imps *Imports, path string) error {
	_, err := imps.ExportAll(path)
	return err
}

func exportAllAs(imps *Imports, path, as string) error {
	_, err := imps.ExportAllAs(path, as)
	return err
}

func export(imps *Imports, path string, exports ...string) error {
	_, err := imps.Export(path, exports...)
	return err
}

func TestImports(t *testing.T) {
	testCases := map[string]testCase{
		"reserve some": {
			fn: func(imps *Imports) {
				require.Nil(t, reserveImport(imps, codepath.Package, "loadEnt", "loadEntX", "Viewer"))

				require.Nil(t, useImport(imps, "loadEnt"))
				require.Nil(t, useImport(imps, "loadEntX"))
			},
			expectedLines: []string{
				getLine("import {loadEnt, loadEntX} from {root};"),
			},
		},
		"nothing used": {
			fn: func(imps *Imports) {
				require.Nil(t, reserveImport(imps, codepath.Package, "loadEnt", "loadEntX", "Viewer"))
			},
			expectedLines: []string{},
		},
		"reserve default. only default used": {
			fn: func(imps *Imports) {
				require.Nil(t, reserveDefaultImport(imps, "src/ent/user", "User", "createUser", "editUser"))

				require.Nil(t, useImport(imps, "User"))
			},
			expectedLines: []string{
				getLine("import User from {path};", "src/ent/user"),
			},
		},
		"reserve default. non-default used": {
			fn: func(imps *Imports) {
				require.Nil(t, reserveDefaultImport(imps, "src/ent/user", "User", "createUser", "editUser"))

				require.Nil(t, useImport(imps, "createUser"))
				require.Nil(t, useImport(imps, "editUser"))
			},
			expectedLines: []string{
				getLine("import {createUser, editUser} from {path};", "src/ent/user"),
			},
		},
		"reserve default. mix used": {
			fn: func(imps *Imports) {
				require.Nil(t, reserveDefaultImport(imps, "src/ent/user", "User", "createUser", "editUser"))

				require.Nil(t, useImport(imps, "createUser"))
				require.Nil(t, useImport(imps, "editUser"))
				require.Nil(t, useImport(imps, "User"))
			},
			expectedLines: []string{
				getLine("import User, {createUser, editUser} from {path};", "src/ent/user"),
			},
		},
		"reserve default. mix used with relPaths": {
			filePath: "src/ent/generated/user_base.ts",
			relPaths: true,
			fn: func(imps *Imports) {
				require.Nil(t, reserveDefaultImport(imps, "src/ent/user", "User", "createUser", "editUser"))

				require.Nil(t, useImport(imps, "createUser"))
				require.Nil(t, useImport(imps, "editUser"))
				require.Nil(t, useImport(imps, "User"))
			},
			expectedLines: []string{
				// just to confirm that we're calling the right thing here.
				// path_test does all the testing
				getLine("import User, {createUser, editUser} from {path};", "../user"),
			},
		},
		"reserve default. mix relPaths. no filePath": {
			relPaths: true,
			fn: func(imps *Imports) {
				require.Nil(t, reserveDefaultImport(imps, "src/ent/user", "User", "createUser", "editUser"))

				require.Nil(t, useImport(imps, "createUser"))
				require.Nil(t, useImport(imps, "editUser"))
				require.Nil(t, useImport(imps, "User"))
			},
			expectedLines: []string{
				// should probably throw here to be honest...
				getLine("import User, {createUser, editUser} from {path};", "src/ent/user"),
			},
		},
		"reserve all. used": {
			fn: func(imps *Imports) {
				require.Nil(t, reserveAllImport(imps, "./core/clause", "clause"))

				require.Nil(t, useImport(imps, "clause"))
			},
			expectedLines: []string{
				getLine("import * as clause from {path};", "./core/clause"),
			},
		},
		"reserve all. not used": {
			fn: func(imps *Imports) {
				require.Nil(t, reserveAllImport(imps, "./core/clause", "clause"))
			},
			expectedLines: []string{},
		},
		// TODO name collisions foo as bar
		// simpler version of * as query?
		"reserve same thing multiple times": {
			fn: func(imps *Imports) {
				require.Nil(t, reserveAllImport(imps, "./core/clause", "clause"))
				require.Error(t, reserveAllImport(imps, "./core/foo", "clause"))
			},
			errorThrown: true,
		},
		"use not reserved": {
			fn: func(imps *Imports) {
				require.Error(t, useImport(imps, "clause"))
			},
			errorThrown: true,
		},
		"use multiple times": {
			fn: func(imps *Imports) {
				reserveAllImport(imps, "./core/clause", "clause")

				useImport(imps, "clause")
				useImport(imps, "clause")
			},
			expectedLines: []string{
				getLine("import * as clause from {path};", "./core/clause"),
			},
		},
		"sorted_combo": {
			fn: func(imps *Imports) {
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
			fn: func(imps *Imports) {
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
			fn: func(imps *Imports) {
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
			fn: func(imps *Imports) {
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
			fn: func(imps *Imports) {
				reserveDefaultImport(imps, "src/ent/user", "User")
				reserveDefaultImport(imps, "src/ent/user", "User")

				useImport(imps, "User")
			},
			expectedLines: []string{
				getLine("import User from {path};", "src/ent/user"),
			},
		},
		"reserve different paths": {
			fn: func(imps *Imports) {
				require.Nil(t, reserveDefaultImport(imps, "src/ent/user", "User"))
				require.Error(t, reserveDefaultImport(imps, "/user", "User"))
			},
			errorThrown: true,
		},
		"export all": {
			fn: func(imps *Imports) {
				require.Nil(t, exportAll(imps, "src/ent/generated/const"))
			},
			expectedLines: []string{
				getLine("export * from {path};", "src/ent/generated/const"),
			},
		},
		"export all as ": {
			fn: func(imps *Imports) {
				require.Nil(t, exportAllAs(imps, "src/ent/generated/const", "foo"))
			},
			expectedLines: []string{
				getLine("export * as foo from {path};", "src/ent/generated/const"),
			},
		},
		"export": {
			fn: func(imps *Imports) {
				require.Nil(t, export(imps, "src/ent/generated/const", "foo", "bar"))
			},
			expectedLines: []string{
				getLine("export {bar, foo} from {path};", "src/ent/generated/const"),
			},
		},
		"export relPath": {
			relPaths: true,
			filePath: "src/ent/generated/user_base.ts",
			fn: func(imps *Imports) {
				require.Nil(t, export(imps, "src/ent/generated/const", "foo", "bar"))
			},
			expectedLines: []string{
				getLine("export {bar, foo} from {path};", "./const"),
			},
		},
		"import + export": {
			fn: func(imps *Imports) {
				require.Nil(t, reserveImport(imps, codepath.Package, "loadEnt", "loadEntX", "Viewer"))

				require.Nil(t, useImport(imps, "loadEntX"))
				require.Nil(t, useImport(imps, "loadEnt"))
				require.Nil(t, export(imps, "src/ent/generated/const", "foo", "bar"))
			},
			expectedLines: []string{
				// export first regardless of order
				getLine("export {bar, foo} from {path};", "src/ent/generated/const"),
				getLine("import {loadEnt, loadEntX} from {path};", codepath.Package),
			},
		},
	}

	filterOnly := false
	for _, tt := range testCases {
		if tt.only {
			filterOnly = true
			break
		}
	}

	for key, tt := range testCases {
		if filterOnly && !tt.only || tt.skip {
			continue
		}
		cfg := &testCfg{
			relPaths: tt.relPaths,
		}
		t.Run(key, func(t *testing.T) {
			imps := NewImports(cfg, tt.filePath)

			if tt.errorThrown {
				assert.Len(t, tt.expectedLines, 0)
				tt.fn(imps)
				validateExpectedLines(t, imps, tt.expectedLines)

			} else {
				tt.fn(imps)

				validateExpectedLines(t, imps, tt.expectedLines)
			}
		})
	}
}

func validateExpectedLines(t *testing.T, imps *Imports, expLines []string) {
	str, err := imps.String()
	require.Nil(t, err)
	lines := strings.Split(str, "\n")
	// remove last element since it's always nonsense
	lines = lines[:len(lines)-1]

	if expLines == nil {
		assert.Len(t, lines, 0)
	} else {
		assert.Equal(t, expLines, lines)
	}
}
