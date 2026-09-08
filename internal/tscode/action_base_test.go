package tscode

import (
	"os"
	"path/filepath"
	"regexp"
	"testing"

	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/codegen/codegenapi"
	"github.com/lolopinto/ent/internal/schema"
	"github.com/lolopinto/ent/internal/schema/base"
	"github.com/lolopinto/ent/internal/schema/input"
	"github.com/stretchr/testify/require"
)

func TestEdgeGroupActionSetupUsesTransactionFailureBoundary(t *testing.T) {
	s, err := schema.ParseFromInputSchema(&codegenapi.DummyConfig{}, &input.Schema{
		Nodes: map[string]*input.Node{
			"User": {
				Fields: []*input.Field{{Name: "id", Type: &input.FieldType{DBType: input.UUID}, PrimaryKey: true}},
				AssocEdgeGroups: []*input.AssocEdgeGroup{{
					Name: "Friendships", GroupStatusName: "FriendshipStatus",
					AssocEdges: []*input.AssocEdge{{Name: "Friends", SchemaName: "User", Symmetric: true}},
					EdgeAction: &input.EdgeAction{Operation: ent.EdgeGroupAction, CustomActionName: "EditFriendshipAction"},
				}},
			},
		},
	}, base.TypeScript)
	require.NoError(t, err)
	rootDir := t.TempDir()
	processor, err := codegen.NewTestCodegenProcessor(filepath.Join(rootDir, "src/schema"), s, &codegen.CodegenConfig{})
	require.NoError(t, err)
	require.NoError(t, processor.Run([]codegen.Step{new(Step)}, "", codegen.DisablePrompts(), codegen.DisableFormat(), codegen.FromTest()))
	output, err := os.ReadFile(filepath.Join(rootDir, "src/ent/generated/user/actions/edit_friendship_action_base.ts"))
	require.NoError(t, err)
	for _, method := range []string{"save", "saveX", "changeset", "changesetWithOptions_BETA"} {
		t.Run(method, func(t *testing.T) {
			boundary := "runActionExecution"
			if method == "changeset" || method == "changesetWithOptions_BETA" {
				boundary = "runActionChangeset"
			}
			pattern := `(?s)async ` + method + `\([^\n]*\).*?\{\s*return ` + boundary + `\(async \(\) => \{\s*await this\.setEdgeType\(\);`
			require.Regexp(t, regexp.MustCompile(pattern), string(output))
		})
	}
	for _, method := range []string{"valid", "validX"} {
		require.Regexp(t, regexp.MustCompile(`async `+method+`\(\)[^{]*\{\s*await this\.setEdgeType\(\);`), string(output))
	}
}
