package tscode

import (
	"os"
	"path"
	"testing"

	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/codegen/codegenapi"
	"github.com/lolopinto/ent/internal/schema"
	"github.com/lolopinto/ent/internal/schema/base"
	"github.com/lolopinto/ent/internal/schema/input"
	"github.com/stretchr/testify/require"
)

func TestPolymorphicIndexedEdgeQueryBaseUsesTypeImportForEntSource(t *testing.T) {
	s, err := schema.ParseFromInputSchema(
		&codegenapi.DummyConfig{},
		&input.Schema{
			Nodes: map[string]*input.Node{
				"User": {
					Fields: []*input.Field{
						{
							Name: "id",
							Type: &input.FieldType{
								DBType: input.UUID,
							},
							PrimaryKey: true,
						},
					},
				},
				"Comment": {
					Fields: []*input.Field{
						{
							Name: "id",
							Type: &input.FieldType{
								DBType: input.UUID,
							},
							PrimaryKey: true,
						},
						{
							Name: "ArticleID",
							Type: &input.FieldType{
								DBType: input.UUID,
							},
							Index: true,
							Polymorphic: &input.PolymorphicOptions{
								Types: []string{"User", "Comment"},
							},
						},
					},
				},
			},
		},
		base.TypeScript,
	)
	require.NoError(t, err)

	rootDir, err := os.MkdirTemp(os.TempDir(), "root")
	require.NoError(t, err)
	defer os.RemoveAll(rootDir)

	processor, err := codegen.NewTestCodegenProcessor(
		path.Join(rootDir, "src/schema"),
		s,
		&codegen.CodegenConfig{},
	)
	require.NoError(t, err)

	err = processor.Run(
		[]codegen.Step{new(Step)},
		"",
		codegen.DisablePrompts(),
		codegen.DisableFormat(),
		codegen.FromTest(),
	)
	require.NoError(t, err)

	b, err := os.ReadFile(path.Join(rootDir, "src/ent/generated/comment_query_base.ts"))
	require.NoError(t, err)
	str := string(b)
	require.Contains(t, str, `import type {Ent, ID, OrderBy, Viewer} from "@snowtop/ent";`)
	require.Contains(t, str, "export class ArticleToCommentsQueryBase<TEnt extends Ent<Viewer> = Ent<Viewer>>")
	require.NotContains(t, str, `import {Ent`)
}
