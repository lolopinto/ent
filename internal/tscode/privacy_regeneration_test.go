package tscode

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/codegen/codegenapi"
	"github.com/lolopinto/ent/internal/schema"
	"github.com/lolopinto/ent/internal/schema/base"
	"github.com/lolopinto/ent/internal/schema/input"
	"github.com/stretchr/testify/require"
)

func privacySchema(t *testing.T, dbOnly, privacy, actions bool) *schema.Schema {
	t.Helper()
	var actionInputs []*input.Action
	if actions {
		actionInputs = []*input.Action{{Operation: ent.CreateAction}, {Operation: ent.EditAction}}
	}
	s, err := schema.ParseFromInputSchema(&codegenapi.DummyConfig{}, &input.Schema{
		Nodes: map[string]*input.Node{"User": {
			Fields: []*input.Field{
				{Name: "id", Type: &input.FieldType{DBType: input.UUID}, PrimaryKey: true},
				{Name: "secret", Nullable: true, Type: &input.FieldType{DBType: input.String}, DBOnly: dbOnly},
			},
			Actions:                 actionInputs,
			HasDefaultActionPrivacy: privacy,
		}},
	}, base.TypeScript)
	require.NoError(t, err)
	return s
}

func TestIncrementalPrivacyRegeneration(t *testing.T) {
	for _, feature := range []string{"dbOnly", "defaultActionPrivacy"} {
		t.Run(feature, func(t *testing.T) {
			root := t.TempDir()
			var previous *schema.Schema
			// Test adding and removing the property, then a no-change comparison.
			for _, enabled := range []bool{false, true, false, false} {
				current := privacySchema(t, feature == "dbOnly" && enabled, feature == "defaultActionPrivacy" && enabled, feature == "defaultActionPrivacy")
				processor, err := codegen.NewTestCodegenProcessor(filepath.Join(root, "src/schema"), current, &codegen.CodegenConfig{})
				require.NoError(t, err)
				if previous != nil {
					changes, err := schema.CompareSchemas(previous, current)
					require.NoError(t, err)
					processor.ChangeMap = changes
					processor.Config.SetChangeMap(changes)
					processor.Config.SetUseChanges(true)
					processor.Config.SetWriteAll(false)
				}
				require.NoError(t, processor.Run([]codegen.Step{new(Step)}, "", codegen.DisablePrompts(), codegen.DisableFormat(), codegen.FromTest()))
				if feature == "dbOnly" {
					b, err := os.ReadFile(filepath.Join(root, "src/ent/generated/user_base.ts"))
					require.NoError(t, err)
					if enabled {
						require.NotContains(t, string(b), "secret:")
					} else {
						require.Contains(t, string(b), "secret:")
					}
				} else {
					for _, action := range []string{"create", "edit"} {
						b, err := os.ReadFile(filepath.Join(root, "src/ent/generated/user/actions", action+"_user_action_base.ts"))
						require.NoError(t, err)
						if enabled {
							require.Contains(t, string(b), "schema.defaultActionPrivacy")
						} else {
							require.NotContains(t, string(b), "schema.defaultActionPrivacy")
						}
					}
				}
				previous = current
			}
		})
	}
}

func TestIncrementalPatternDBOnlyRegeneration(t *testing.T) {
	root := t.TempDir()
	var previous *schema.Schema
	for _, enabled := range []bool{false, true, false, false} {
		f := &input.Field{Name: "secret", Nullable: true, Type: &input.FieldType{DBType: input.String}, DBOnly: enabled, PatternName: "sensitive"}
		current, err := schema.ParseFromInputSchema(&codegenapi.DummyConfig{}, &input.Schema{
			Nodes:    map[string]*input.Node{"User": {Fields: []*input.Field{{Name: "id", Type: &input.FieldType{DBType: input.UUID}, PrimaryKey: true}, f}, Patterns: []string{"sensitive"}}},
			Patterns: map[string]*input.Pattern{"sensitive": {Name: "sensitive", Fields: []*input.Field{f}}},
		}, base.TypeScript)
		require.NoError(t, err)
		processor, err := codegen.NewTestCodegenProcessor(filepath.Join(root, "src/schema"), current, &codegen.CodegenConfig{})
		require.NoError(t, err)
		if previous != nil {
			changes, err := schema.CompareSchemas(previous, current)
			require.NoError(t, err)

			processor.ChangeMap = changes
			processor.Config.SetChangeMap(changes)
			processor.Config.SetUseChanges(true)
			processor.Config.SetWriteAll(false)
		}
		require.NoError(t, processor.Run([]codegen.Step{new(Step)}, "", codegen.DisablePrompts(), codegen.DisableFormat(), codegen.FromTest()))
		b, err := os.ReadFile(filepath.Join(root, "src/ent/generated/mixins/sensitive_base.ts"))
		require.NoError(t, err)
		if enabled {
			require.NotContains(t, string(b), "this.secret = data.secret")
		} else {
			require.Contains(t, string(b), "this.secret = data.secret")
		}
		previous = current
	}
}

func TestIncrementalImmutableRegeneration(t *testing.T) {
	root := t.TempDir()
	var previous *schema.Schema
	for _, enabled := range []bool{false, true, false, false} {
		current, err := schema.ParseFromInputSchema(&codegenapi.DummyConfig{}, &input.Schema{Nodes: map[string]*input.Node{"User": {
			Fields:  []*input.Field{{Name: "id", Type: &input.FieldType{DBType: input.UUID}, PrimaryKey: true}, {Name: "secret", Type: &input.FieldType{DBType: input.String}, Immutable: enabled}},
			Actions: []*input.Action{{Operation: ent.CreateAction}},
		}}}, base.TypeScript)
		require.NoError(t, err)
		processor, err := codegen.NewTestCodegenProcessor(filepath.Join(root, "src/schema"), current, &codegen.CodegenConfig{})
		require.NoError(t, err)
		if previous != nil {
			changes, err := schema.CompareSchemas(previous, current)
			require.NoError(t, err)
			processor.ChangeMap = changes
			processor.Config.SetChangeMap(changes)
			processor.Config.SetUseChanges(true)
			processor.Config.SetWriteAll(false)
		}
		require.NoError(t, processor.Run([]codegen.Step{new(Step)}, "", codegen.DisablePrompts(), codegen.DisableFormat(), codegen.FromTest()))
		b, err := os.ReadFile(filepath.Join(root, "src/ent/generated/user/actions/user_builder.ts"))
		require.NoError(t, err)
		if enabled {
			require.Contains(t, string(b), "secret cannot be passed to updateInput")
		} else {
			require.NotContains(t, string(b), "secret cannot be passed to updateInput")
		}
		previous = current
	}
}
