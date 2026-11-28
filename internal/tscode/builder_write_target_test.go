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

func TestBuilderAccessorsUseWriteTargetWhileEditHooksRetainNonNullEntity(t *testing.T) {
	s, err := schema.ParseFromInputSchema(&codegenapi.DummyConfig{}, &input.Schema{
		Nodes: map[string]*input.Node{
			"Document": {
				Fields: []*input.Field{
					{Name: "id", Type: &input.FieldType{DBType: input.UUID}, PrimaryKey: true, HasDefaultValueOnCreate: true},
					{Name: "title", Type: &input.FieldType{DBType: input.String}},
					{Name: "summary", Type: &input.FieldType{DBType: input.String}, Nullable: true},
					{Name: "revision", Type: &input.FieldType{DBType: input.Int}},
				},
				Actions: []*input.Action{{Operation: ent.CreateAction}, {Operation: ent.EditAction}, {Operation: ent.DeleteAction}},
			},
		},
	}, base.TypeScript)
	require.NoError(t, err)
	root := t.TempDir()
	processor, err := codegen.NewTestCodegenProcessor(filepath.Join(root, "src/schema"), s, &codegen.CodegenConfig{})
	require.NoError(t, err)
	require.NoError(t, processor.Run([]codegen.Step{new(Step)}, "", codegen.DisablePrompts(), codegen.DisableFormat(), codegen.FromTest()))
	data, err := os.ReadFile(filepath.Join(root, "src/ent/generated/document/actions/document_builder.ts"))
	require.NoError(t, err)
	builder := string(data)
	require.Contains(t, builder, "const existingEnt = this.orchestrator.getExistingEntForWrite();")
	require.Contains(t, builder, "return this.orchestrator.getEntID();")
	require.Contains(t, builder, "return existingEnt.title;")
	require.Contains(t, builder, "return existingEnt?.summary ?? null;")
	require.NotContains(t, builder, "return this.existingEnt.")
	for _, action := range []string{"edit", "delete"} {
		data, err = os.ReadFile(filepath.Join(root, "src/ent/generated/document/actions", action+"_document_action_base.ts"))
		require.NoError(t, err)
		require.Contains(t, string(data), "public readonly builder: DocumentBuilder<")
		require.Regexp(t, `public readonly builder: DocumentBuilder<[^;]+, Document>;`, string(data))
	}
}
