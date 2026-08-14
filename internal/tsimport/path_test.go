package tsimport

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type pathTestCase struct {
	filePath   string
	importPath string
	expResult  string
	only, skip bool
}

func TestImportPath(t *testing.T) {
	tests := map[string]pathTestCase{
		"internal from ent": {
			filePath:   "src/ent/user.ts",
			importPath: "src/ent/internal",
			expResult:  "./internal",
		},
		"ent from internal": {
			filePath:   "src/ent/internal.ts",
			importPath: "src/ent/user",
			expResult:  "./user",
		},
		"generated ent from internal": {
			filePath:   "src/ent/internal.ts",
			importPath: "src/ent/generated/user_base",
			expResult:  "./generated/user_base",
		},
		"schema from generated": {
			filePath:   "src/ent/generated/user_base.ts",
			importPath: "src/schema/user",
			expResult:  "../../schema/user",
		},
		"internal from super nested": {
			filePath:   "src/ent/user/query/user_to_fun_events_query.ts",
			importPath: "src/ent/internal",
			expResult:  "../../internal",
		},
		"ent root from action builder": {
			filePath:   "src/ent/user/actions/user_builder.ts",
			importPath: "src/ent/",
			expResult:  "../..", // so bad. should we at least add trailing /?
		},
		"ent root from generated action": {
			filePath:   "src/ent/user/actions/generated/confirm_edit_email_address_action_base.ts",
			importPath: "src/ent/",
			expResult:  "../../..",
		},
		"action base from action": {
			filePath:   "src/ent/user/actions/create_user_action.ts",
			importPath: "src/ent/user/actions/generated/create_user_action_base",
			expResult:  "./generated/create_user_action_base",
		},
		"one action from another": {
			filePath:   "src/ent/user/actions/create_user_action.ts",
			importPath: "src/ent/contact/actions/create_contact_action",
			expResult:  "../../contact/actions/create_contact_action",
		},
		"ent from graphql": {
			filePath:   "src/graphql/generated/resolvers/user_type.ts",
			importPath: "src/ent",
			expResult:  "../../../ent",
		},
		"graphql internal from graphql": {
			filePath:   "src/graphql/generated/resolvers/user_type.ts",
			importPath: "src/graphql/resolvers/internal",
			expResult:  "../../resolvers/internal",
		},
		"directory root from nested path in dir": {
			filePath:   "src/ent/user/actions/create_user_action.ts",
			importPath: "src/ent/user/",
			expResult:  "..",
		},
		"file which could be directly from nested path in dir": {
			filePath:   "src/ent/user/actions/create_user_action.ts",
			importPath: "src/ent/user",
			expResult:  "../../user",
		},
	}

	hasOnly := false
	for _, v := range tests {
		if v.only {
			hasOnly = true
			break
		}
	}

	for k, v := range tests {
		if hasOnly && !v.only || v.skip {
			continue
		}
		t.Run(k+"relPaths", func(t *testing.T) {
			res, err := getImportPath(&testCfg{
				relPaths: true,
			}, v.filePath, v.importPath)
			require.Nil(t, err)
			assert.Equal(t, v.expResult, res)
		})
		t.Run(k+"srcPath", func(t *testing.T) {
			res, err := getImportPath(&testCfg{}, v.filePath, v.importPath)
			require.Nil(t, err)
			assert.Equal(t, v.importPath, res)
		})
	}
}

func TestESMImportPath(t *testing.T) {
	cfg := &testCfg{
		relPaths:         true,
		importExtensions: true,
	}
	tests := map[string]pathTestCase{
		"project file": {
			filePath:   "src/ent/user.ts",
			importPath: "src/ent/internal",
			expResult:  "./internal.js",
		},
		"project directory uses explicit index": {
			filePath:   "src/ent/user/actions/create_user_action.ts",
			importPath: "src/ent/",
			expResult:  "../../index.js",
		},
		"relative file": {
			filePath:   "src/ent/generated/loaders.ts",
			importPath: "./types",
			expResult:  "./types.js",
		},
		"relative typescript extension": {
			filePath:   "src/ent/generated/loaders.ts",
			importPath: "../user.ts",
			expResult:  "../user.js",
		},
		"relative directory uses explicit index": {
			filePath:   "src/ent/generated/user_base.ts",
			importPath: "../",
			expResult:  "../index.js",
		},
		"dot-relative directory keeps relative prefix": {
			filePath:   "src/ent/generated/user_base.ts",
			importPath: "./actions/",
			expResult:  "./actions/index.js",
		},
		"current directory keeps relative prefix": {
			filePath:   "src/ent/generated/user_base.ts",
			importPath: ".",
			expResult:  "./index.js",
		},
		"javascript extension is preserved": {
			filePath:   "src/ent/generated/loaders.ts",
			importPath: "./runtime.js",
			expResult:  "./runtime.js",
		},
		"json extension is preserved": {
			filePath:   "src/ent/generated/loaders.ts",
			importPath: "./metadata.json",
			expResult:  "./metadata.json",
		},
		"package import is unchanged": {
			filePath:   "src/ent/generated/user_base.ts",
			importPath: "@snowtop/ent/action",
			expResult:  "@snowtop/ent/action",
		},
	}

	for name, test := range tests {
		t.Run(name, func(t *testing.T) {
			actual, err := getImportPath(cfg, test.filePath, test.importPath)
			require.NoError(t, err)
			assert.Equal(t, test.expResult, actual)
		})
	}
}

func TestNewLocalGraphQLInputEntImportPath(t *testing.T) {
	ip := NewLocalGraphQLInputEntImportPath("UserAuthJWT")
	assert.Equal(t, "UserAuthJWTInputType", ip.Import)
	assert.Equal(t, "src/graphql/generated/mutations/input/user_auth_jwt_input_type", ip.ImportPath)
}

type testCfg struct {
	relPaths         bool
	importExtensions bool
}

func (cfg *testCfg) GetAbsPathToRoot() string {
	return "/home/code"
}

func (cfg *testCfg) ShouldUseRelativePaths() bool {
	return cfg.relPaths
}

func (cfg *testCfg) ShouldAddImportExtensions() bool {
	return cfg.importExtensions
}

func (cfg *testCfg) DebugMode() bool {
	return false
}
