package cmd

import (
	"io/ioutil"
	"os"
	"path"
	"path/filepath"
	"testing"

	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/schema"
	"github.com/lolopinto/ent/internal/schema/base"
	"github.com/lolopinto/ent/internal/schema/input"
	"github.com/lolopinto/ent/internal/tscode"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSimpleCodegen(t *testing.T) {
	s, err := schema.ParseFromInputSchema(&input.Schema{
		Nodes: map[string]*input.Node{
			"User": {
				Fields: []*input.Field{
					{
						Name: "name",
						Type: &input.FieldType{
							DBType: input.String,
						},
						PrimaryKey: true,
					},
				},
			},
		},
	}, base.TypeScript)
	require.Nil(t, err)

	rootDir, err := ioutil.TempDir(os.TempDir(), "root")
	require.Nil(t, err)
	defer os.RemoveAll(rootDir)
	schemaPath := path.Join(rootDir, "src/schema")

	processor, err := codegen.NewCodegenProcessor(s, schemaPath, "", false)
	require.Nil(t, err)

	steps := []codegen.Step{
		new(tscode.Step),
	}

	err = processor.Run(steps, "", codegen.DisablePrompts(), codegen.DisableFormat())
	require.Nil(t, err)

	validateFileExists(t, rootDir, "src/ent/generated/user_base.ts")
	validateFileExists(t, rootDir, "src/ent/user.ts")
	validateFileExists(t, rootDir, "src/ent/const.ts")
	validateFileExists(t, rootDir, "src/ent/internal.ts")
	validateFileExists(t, rootDir, "src/ent/index.ts")
	validateFileExists(t, rootDir, "src/ent/loadAny.ts")
}

func TestSchemaWithFkeyEdgeCodegen(t *testing.T) {
	s, err := schema.ParseFromInputSchema(&input.Schema{
		Nodes: map[string]*input.Node{
			"User": {
				Fields: []*input.Field{
					{
						Name: "ID",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						PrimaryKey: true,
					},
					{
						Name: "name",
						Type: &input.FieldType{
							DBType: input.String,
						},
					},
				},
			},
			"Contact": {
				Fields: []*input.Field{
					{
						Name: "ID",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						PrimaryKey: true,
					},
					{
						Name: "UserID",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						ForeignKey: &input.ForeignKey{
							Schema: "User",
							Column: "ID",
						},
					},
					{
						Name: "DuplicateUserID",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						ForeignKey: &input.ForeignKey{
							Schema: "User",
							Column: "ID",
							Name:   "duplicate_contacts",
						},
					},
				},
			},
		},
	}, base.TypeScript)
	require.Nil(t, err)

	rootDir, err := ioutil.TempDir(os.TempDir(), "root")
	require.Nil(t, err)
	defer os.RemoveAll(rootDir)
	schemaPath := path.Join(rootDir, "src/schema")

	processor, err := codegen.NewCodegenProcessor(s, schemaPath, "", false)
	require.Nil(t, err)

	steps := []codegen.Step{
		new(tscode.Step),
	}

	err = processor.Run(steps, "", codegen.DisablePrompts(), codegen.DisableFormat())
	require.Nil(t, err)

	validateFileExists(t, rootDir, "src/ent/generated/user_base.ts")
	validateFileExists(t, rootDir, "src/ent/user.ts")
	validateFileExists(t, rootDir, "src/ent/generated/contact_base.ts")
	validateFileExists(t, rootDir, "src/ent/contact.ts")
	validateFileExists(t, rootDir, "src/ent/const.ts")
	validateFileExists(t, rootDir, "src/ent/internal.ts")
	validateFileExists(t, rootDir, "src/ent/index.ts")
	validateFileExists(t, rootDir, "src/ent/loadAny.ts")
	validateFileExists(t, rootDir, "src/ent/generated/user_query_base.ts")
	validateFileExists(t, rootDir, "src/ent/user/query/user_to_contacts_query.ts")
	validateFileExists(t, rootDir, "src/ent/user/query/user_to_duplicate_contacts_query.ts")
}

func TestSchemaWithAssocEdgeCodegen(t *testing.T) {
	s, err := schema.ParseFromInputSchema(&input.Schema{
		Nodes: map[string]*input.Node{
			"User": {
				Fields: []*input.Field{
					{
						Name: "ID",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						PrimaryKey: true,
					},
					{
						Name: "name",
						Type: &input.FieldType{
							DBType: input.String,
						},
					},
				},
				AssocEdges: []*input.AssocEdge{
					{
						Name:       "Friends",
						SchemaName: "User",
						Symmetric:  true,
						EdgeActions: []*input.EdgeAction{
							{
								Operation: ent.AddEdgeAction,
							},
						},
					},
					{
						Name:       "Followers",
						SchemaName: "User",
						InverseEdge: &input.InverseAssocEdge{
							Name: "Followees",
						},
						EdgeActions: []*input.EdgeAction{
							{
								Operation: ent.AddEdgeAction,
							},
						},
					},
				},
			},
		},
	}, base.TypeScript)
	require.Nil(t, err)

	rootDir, err := ioutil.TempDir(os.TempDir(), "root")
	require.Nil(t, err)
	defer os.RemoveAll(rootDir)
	schemaPath := path.Join(rootDir, "src/schema")

	processor, err := codegen.NewCodegenProcessor(s, schemaPath, "", false)
	require.Nil(t, err)

	steps := []codegen.Step{
		new(tscode.Step),
	}

	err = processor.Run(steps, "", codegen.DisablePrompts(), codegen.DisableFormat())
	require.Nil(t, err)

	validateFileExists(t, rootDir, "src/ent/generated/user_base.ts")
	validateFileExists(t, rootDir, "src/ent/user.ts")
	validateFileExists(t, rootDir, "src/ent/const.ts")
	validateFileExists(t, rootDir, "src/ent/internal.ts")
	validateFileExists(t, rootDir, "src/ent/index.ts")
	validateFileExists(t, rootDir, "src/ent/loadAny.ts")
	validateFileExists(t, rootDir, "src/ent/generated/user_query_base.ts")
	validateFileExists(t, rootDir, "src/ent/user/query/user_to_friends_query.ts")
	validateFileExists(t, rootDir, "src/ent/user/query/user_to_followers_query.ts")
	validateFileExists(t, rootDir, "src/ent/user/query/user_to_followees_query.ts")
	validateFileExists(t, rootDir, "src/ent/user/actions/generated/user_add_friend_action_base.ts")
	validateFileExists(t, rootDir, "src/ent/user/actions/generated/user_add_follower_action_base.ts")
	validateFileExists(t, rootDir, "src/ent/user/actions/user_add_friend_action.ts")
	validateFileExists(t, rootDir, "src/ent/user/actions/user_add_follower_action.ts")
	validateFileExists(t, rootDir, "src/ent/user/actions/user_builder.ts")
}

func TestSchemaWithActionsCodegen(t *testing.T) {
	s, err := schema.ParseFromInputSchema(&input.Schema{
		Nodes: map[string]*input.Node{
			"User": {
				Fields: []*input.Field{
					{
						Name: "ID",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
						PrimaryKey: true,
					},
					{
						Name: "name",
						Type: &input.FieldType{
							DBType: input.String,
						},
					},
				},
				Actions: []*input.Action{
					{
						Operation: ent.CreateAction,
					},
					{
						Operation: ent.EditAction,
					},
					{
						Operation: ent.DeleteAction,
					},
					{
						Operation:         ent.EditAction,
						Fields:            []string{"name"},
						CustomActionName:  "EditUserNameAction",
						CustomGraphQLName: "UserEditName",
						CustomInputName:   "EditNameInput",
					},
				},
			},
		},
	}, base.TypeScript)
	require.Nil(t, err)

	rootDir, err := ioutil.TempDir(os.TempDir(), "root")
	require.Nil(t, err)
	defer os.RemoveAll(rootDir)
	schemaPath := path.Join(rootDir, "src/schema")

	processor, err := codegen.NewCodegenProcessor(s, schemaPath, "", false)
	require.Nil(t, err)

	steps := []codegen.Step{
		new(tscode.Step),
	}

	err = processor.Run(steps, "", codegen.DisablePrompts(), codegen.DisableFormat())
	require.Nil(t, err)

	validateFileExists(t, rootDir, "src/ent/generated/user_base.ts")
	validateFileExists(t, rootDir, "src/ent/user.ts")
	validateFileExists(t, rootDir, "src/ent/const.ts")
	validateFileExists(t, rootDir, "src/ent/internal.ts")
	validateFileExists(t, rootDir, "src/ent/index.ts")
	validateFileExists(t, rootDir, "src/ent/loadAny.ts")
	validateFileExists(t, rootDir, "src/ent/user/actions/generated/create_user_action_base.ts")
	validateFileExists(t, rootDir, "src/ent/user/actions/create_user_action.ts")
	validateFileExists(t, rootDir, "src/ent/user/actions/generated/edit_user_action_base.ts")
	validateFileExists(t, rootDir, "src/ent/user/actions/edit_user_action.ts")
	validateFileExists(t, rootDir, "src/ent/user/actions/generated/edit_user_action_base.ts")
	validateFileExists(t, rootDir, "src/ent/user/actions/edit_user_action.ts")
	validateFileExists(t, rootDir, "src/ent/user/actions/generated/edit_user_name_action_base.ts")
	validateFileExists(t, rootDir, "src/ent/user/actions/edit_user_name_action.ts")
}

func validateFileExists(t *testing.T, root, path string) {
	path = filepath.Join(root, path)
	fi, err := os.Stat(path)
	require.Nil(t, err)
	assert.False(t, fi.IsDir())
}
