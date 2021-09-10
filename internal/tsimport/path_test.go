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
			only:       true,
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
			filePath:   "src/graphql/resolvers/generated/user_type.ts",
			importPath: "src/ent",
			expResult:  "../../../ent",
		},
		"graphql internal from graphql": {
			filePath:   "src/graphql/resolvers/generated/user_type.ts",
			importPath: "src/graphql/resolvers/internal",
			expResult:  "../internal",
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

type testCfg struct {
	relPaths bool
}

func (cfg *testCfg) GetAbsPathToRoot() string {
	return "/home/code"
}

func (cfg *testCfg) ShouldUseRelativePaths() bool {
	return cfg.relPaths
}
