package cmd

import (
	"fmt"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"strings"
	"testing"

	"github.com/davecgh/go-spew/spew"
	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/codegen/codegenapi"
	"github.com/lolopinto/ent/internal/graphql"
	"github.com/lolopinto/ent/internal/schema"
	"github.com/lolopinto/ent/internal/schema/base"
	"github.com/lolopinto/ent/internal/schema/input"
	"github.com/lolopinto/ent/internal/schema/testhelper"
	"github.com/lolopinto/ent/internal/tscode"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var codegenOptions = []codegen.Option{
	codegen.DisablePrompts(),
	codegen.DisableFormat(),
	codegen.FromTest(),
}

func runSteps(t *testing.T, s *schema.Schema, rootDir string) {
	schemaPath := path.Join(rootDir, "src/schema")

	processor, err := codegen.NewCodegenProcessor(s, schemaPath)
	require.Nil(t, err)

	runStepsWithProcessor(t, s, rootDir, processor)
}

func runStepsWithProcessor(t *testing.T, s *schema.Schema, rootDir string, processor *codegen.Processor) {
	steps := []codegen.Step{
		new(tscode.Step),
		new(graphql.TSStep),
	}

	err := processor.Run(steps, "", codegenOptions...)
	require.Nil(t, err)
}

func TestSimpleCodegen(t *testing.T) {
	s, err := schema.ParseFromInputSchema(&codegenapi.DummyConfig{},
		&input.Schema{
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

	rootDir, err := os.MkdirTemp(os.TempDir(), "root")
	require.Nil(t, err)
	defer os.RemoveAll(rootDir)
	runSteps(t, s, rootDir)

	validateFileExists(t, rootDir, "src/ent/generated/user_base.ts")
	validateFileExists(t, rootDir, "src/ent/user.ts")
	validateFileExists(t, rootDir, "src/ent/generated/types.ts")
	validateFileExists(t, rootDir, "src/ent/internal.ts")
	validateFileExists(t, rootDir, "src/ent/index.ts")
	validateFileExists(t, rootDir, "src/ent/generated/loadAny.ts")
	validateFileExists(t, rootDir, "src/graphql/generated/resolvers/user_type.ts")
	validateFileExists(t, rootDir, "src/graphql/resolvers/node_query_type.ts")
	validateFileExists(t, rootDir, "src/graphql/generated/resolvers/query_type.ts")
	validateFileExists(t, rootDir, "src/graphql/resolvers/internal.ts")
	validateFileExists(t, rootDir, "src/graphql/resolvers/index.ts")
	validateFileExists(t, rootDir, "src/graphql/generated/schema.ts")
	validateFileExists(t, rootDir, "src/graphql/index.ts")

	f := path.Join(rootDir, "src/ent/generated/user_base.ts")
	b, err := os.ReadFile(f)
	require.Nil(t, err)
	str := string(b)
	assert.True(
		t,
		strings.HasPrefix(
			str,
			"// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.\n",
		),
	)
}

func TestDisableGraphQLRoot(t *testing.T) {
	s, err := schema.ParseFromInputSchema(
		&codegenapi.DummyConfig{},
		&input.Schema{
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

	rootDir, err := os.MkdirTemp(os.TempDir(), "root")
	require.Nil(t, err)
	defer os.RemoveAll(rootDir)

	schemaPath := path.Join(rootDir, "src/schema")

	processor, err := codegen.NewTestCodegenProcessor(schemaPath, s, &codegen.CodegenConfig{
		DisableGraphQLRoot: true,
	})
	require.Nil(t, err)
	runStepsWithProcessor(t, s, rootDir, processor)

	validateFileExists(t, rootDir, "src/ent/generated/user_base.ts")
	validateFileExists(t, rootDir, "src/ent/user.ts")
	validateFileExists(t, rootDir, "src/ent/generated/types.ts")
	validateFileExists(t, rootDir, "src/ent/internal.ts")
	validateFileExists(t, rootDir, "src/ent/index.ts")
	validateFileExists(t, rootDir, "src/ent/generated/loadAny.ts")
	validateFileExists(t, rootDir, "src/graphql/generated/resolvers/user_type.ts")
	validateFileExists(t, rootDir, "src/graphql/resolvers/node_query_type.ts")
	validateFileExists(t, rootDir, "src/graphql/generated/resolvers/query_type.ts")
	validateFileExists(t, rootDir, "src/graphql/resolvers/internal.ts")
	validateFileExists(t, rootDir, "src/graphql/resolvers/index.ts")
	validateFileExists(t, rootDir, "src/graphql/generated/schema.ts")
	validateFileDoesNotExist(t, rootDir, "src/graphql/index.ts")
}

func TestGeneratedHeader(t *testing.T) {
	s, err := schema.ParseFromInputSchema(
		&codegenapi.DummyConfig{},
		&input.Schema{
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

	rootDir, err := os.MkdirTemp(os.TempDir(), "root")
	require.Nil(t, err)
	defer os.RemoveAll(rootDir)

	schemaPath := path.Join(rootDir, "src/schema")

	processor, err := codegen.NewTestCodegenProcessor(schemaPath, s, &codegen.CodegenConfig{
		GeneratedHeader: "Copyright foo bar",
	})
	require.Nil(t, err)
	runStepsWithProcessor(t, s, rootDir, processor)

	validateFileExists(t, rootDir, "src/ent/generated/user_base.ts")
	validateFileExists(t, rootDir, "src/ent/user.ts")
	validateFileExists(t, rootDir, "src/ent/generated/types.ts")
	validateFileExists(t, rootDir, "src/ent/internal.ts")
	validateFileExists(t, rootDir, "src/ent/index.ts")
	validateFileExists(t, rootDir, "src/ent/generated/loadAny.ts")
	validateFileExists(t, rootDir, "src/graphql/generated/resolvers/user_type.ts")
	validateFileExists(t, rootDir, "src/graphql/resolvers/node_query_type.ts")
	validateFileExists(t, rootDir, "src/graphql/generated/resolvers/query_type.ts")
	validateFileExists(t, rootDir, "src/graphql/resolvers/internal.ts")
	validateFileExists(t, rootDir, "src/graphql/resolvers/index.ts")
	validateFileExists(t, rootDir, "src/graphql/generated/schema.ts")
	validateFileExists(t, rootDir, "src/graphql/index.ts")

	f := path.Join(rootDir, "src/ent/generated/user_base.ts")
	b, err := os.ReadFile(f)
	require.Nil(t, err)
	str := string(b)
	assert.True(
		t,
		strings.HasPrefix(
			str,
			fmt.Sprintf(
				"/**\n * %s\n * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.\n */", "Copyright foo bar",
			),
		),
	)

	f2 := path.Join(rootDir, "src/ent/user.ts")
	b2, err := os.ReadFile(f2)
	require.Nil(t, err)
	str2 := string(b2)
	assert.True(
		t,
		strings.HasPrefix(
			str2,
			fmt.Sprintf(
				"/**\n * %s\n */", "Copyright foo bar",
			),
		),
	)
}

func TestSchemaWithFkeyEdgeCodegen(t *testing.T) {
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
							Name: "id",
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
								Column: "id",
							},
						},
						{
							Name: "DuplicateUserID",
							Type: &input.FieldType{
								DBType: input.UUID,
							},
							ForeignKey: &input.ForeignKey{
								Schema: "User",
								Column: "id",
								Name:   "duplicate_contacts",
							},
						},
					},
				},
			},
		}, base.TypeScript)
	require.Nil(t, err)

	rootDir, err := os.MkdirTemp(os.TempDir(), "root")
	require.Nil(t, err)
	defer os.RemoveAll(rootDir)
	runSteps(t, s, rootDir)

	validateFileExists(t, rootDir, "src/ent/generated/user_base.ts")
	validateFileExists(t, rootDir, "src/ent/user.ts")
	validateFileExists(t, rootDir, "src/ent/generated/contact_base.ts")
	validateFileExists(t, rootDir, "src/ent/contact.ts")
	validateFileExists(t, rootDir, "src/ent/generated/types.ts")
	validateFileExists(t, rootDir, "src/ent/internal.ts")
	validateFileExists(t, rootDir, "src/ent/index.ts")
	validateFileExists(t, rootDir, "src/ent/generated/loadAny.ts")
	validateFileExists(t, rootDir, "src/ent/generated/user_query_base.ts")
	validateFileExists(t, rootDir, "src/ent/user/query/user_to_contacts_query.ts")
	validateFileExists(t, rootDir, "src/ent/user/query/user_to_duplicate_contacts_query.ts")
	validateFileExists(t, rootDir, "src/graphql/generated/resolvers/user_type.ts")
	validateFileExists(t, rootDir, "src/graphql/generated/resolvers/contact_type.ts")
	validateFileExists(t, rootDir, "src/graphql/generated/resolvers/user/user_to_contacts_connection_type.ts")
	validateFileExists(t, rootDir, "src/graphql/generated/resolvers/user/user_to_duplicate_contacts_connection_type.ts")
	validateFileExists(t, rootDir, "src/graphql/resolvers/node_query_type.ts")
	validateFileExists(t, rootDir, "src/graphql/generated/resolvers/query_type.ts")
	validateFileExists(t, rootDir, "src/graphql/resolvers/internal.ts")
	validateFileExists(t, rootDir, "src/graphql/resolvers/index.ts")
	validateFileExists(t, rootDir, "src/graphql/generated/schema.ts")
	validateFileExists(t, rootDir, "src/graphql/index.ts")
}

func TestSchemaWithAssocEdgeCodegen(t *testing.T) {
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

	rootDir, err := os.MkdirTemp(os.TempDir(), "root")
	require.Nil(t, err)
	defer os.RemoveAll(rootDir)
	runSteps(t, s, rootDir)

	validateFileExists(t, rootDir, "src/ent/generated/user_base.ts")
	validateFileExists(t, rootDir, "src/ent/user.ts")
	validateFileExists(t, rootDir, "src/ent/generated/types.ts")
	validateFileExists(t, rootDir, "src/ent/internal.ts")
	validateFileExists(t, rootDir, "src/ent/index.ts")
	validateFileExists(t, rootDir, "src/ent/generated/loadAny.ts")
	validateFileExists(t, rootDir, "src/ent/generated/user_query_base.ts")
	validateFileExists(t, rootDir, "src/ent/user/query/user_to_friends_query.ts")
	validateFileExists(t, rootDir, "src/ent/user/query/user_to_followers_query.ts")
	validateFileExists(t, rootDir, "src/ent/user/query/user_to_followees_query.ts")
	validateFileExists(t, rootDir, "src/ent/generated/user/actions/user_add_friend_action_base.ts")
	validateFileExists(t, rootDir, "src/ent/generated/user/actions/user_add_follower_action_base.ts")
	validateFileExists(t, rootDir, "src/ent/user/actions/user_add_friend_action.ts")
	validateFileExists(t, rootDir, "src/ent/user/actions/user_add_follower_action.ts")
	validateFileExists(t, rootDir, "src/ent/generated/user/actions/user_builder.ts")
	validateFileExists(t, rootDir, "src/graphql/generated/resolvers/user_type.ts")
	validateFileExists(t, rootDir, "src/graphql/resolvers/node_query_type.ts")
	validateFileExists(t, rootDir, "src/graphql/generated/resolvers/query_type.ts")
	validateFileExists(t, rootDir, "src/graphql/resolvers/internal.ts")
	validateFileExists(t, rootDir, "src/graphql/resolvers/index.ts")
	validateFileExists(t, rootDir, "src/graphql/generated/schema.ts")
	validateFileExists(t, rootDir, "src/graphql/index.ts")
	validateFileExists(t, rootDir, "src/graphql/generated/resolvers/user/user_to_friends_connection_type.ts")
	validateFileExists(t, rootDir, "src/graphql/generated/resolvers/user/user_to_followers_connection_type.ts")
	validateFileExists(t, rootDir, "src/graphql/generated/resolvers/user/user_to_followees_connection_type.ts")
	validateFileExists(t, rootDir, "src/graphql/generated/mutations/user/user_add_friend_type.ts")
	validateFileExists(t, rootDir, "src/graphql/generated/mutations/user/user_add_follower_type.ts")
}

func TestSchemaWithActionsCodegen(t *testing.T) {
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
							// mark it as non user editable. same as we do with patterns
							DisableUserEditable: true,
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

	rootDir, err := os.MkdirTemp(os.TempDir(), "root")
	require.Nil(t, err)
	defer os.RemoveAll(rootDir)
	runSteps(t, s, rootDir)

	validateFileExists(t, rootDir, "src/ent/generated/user_base.ts")
	validateFileExists(t, rootDir, "src/ent/user.ts")
	validateFileExists(t, rootDir, "src/ent/generated/types.ts")
	validateFileExists(t, rootDir, "src/ent/internal.ts")
	validateFileExists(t, rootDir, "src/ent/index.ts")
	validateFileExists(t, rootDir, "src/ent/generated/loadAny.ts")
	validateFileExists(t, rootDir, "src/ent/generated/user/actions/create_user_action_base.ts")
	validateFileExists(t, rootDir, "src/ent/user/actions/create_user_action.ts")
	validateFileExists(t, rootDir, "src/ent/generated/user/actions/edit_user_action_base.ts")
	validateFileExists(t, rootDir, "src/ent/user/actions/edit_user_action.ts")
	validateFileExists(t, rootDir, "src/ent/generated/user/actions/edit_user_action_base.ts")
	validateFileExists(t, rootDir, "src/ent/user/actions/edit_user_action.ts")
	validateFileExists(t, rootDir, "src/ent/generated/user/actions/edit_user_name_action_base.ts")
	validateFileExists(t, rootDir, "src/ent/user/actions/edit_user_name_action.ts")
	validateFileExists(t, rootDir, "src/graphql/generated/resolvers/user_type.ts")
	validateFileExists(t, rootDir, "src/graphql/resolvers/node_query_type.ts")
	validateFileExists(t, rootDir, "src/graphql/generated/resolvers/query_type.ts")
	validateFileExists(t, rootDir, "src/graphql/resolvers/internal.ts")
	validateFileExists(t, rootDir, "src/graphql/resolvers/index.ts")
	validateFileExists(t, rootDir, "src/graphql/generated/schema.ts")
	validateFileExists(t, rootDir, "src/graphql/index.ts")
	validateFileExists(t, rootDir, "src/graphql/generated/mutations/user/user_create_type.ts")
	validateFileExists(t, rootDir, "src/graphql/generated/mutations/user/user_edit_type.ts")
	validateFileExists(t, rootDir, "src/graphql/generated/mutations/user/user_delete_type.ts")
	validateFileExists(t, rootDir, "src/graphql/generated/mutations/user/user_edit_name_type.ts")
}

func TestSchemaWithPattern(t *testing.T) {
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
						{
							Name: "name",
							Type: &input.FieldType{
								DBType: input.String,
							},
						},
					},
					AssocEdges: []*input.AssocEdge{
						{
							Name:        "likes",
							SchemaName:  "User",
							PatternName: "feedbackTarget",
						},
					},
				},
			},
			Patterns: map[string]*input.Pattern{
				"feedbackTarget": {
					Name: "feedbackTarget",
					AssocEdges: []*input.AssocEdge{
						{
							Name:       "likes",
							SchemaName: "User",
						},
					},
				},
			},
		}, base.TypeScript)
	require.Nil(t, err)

	rootDir, err := os.MkdirTemp(os.TempDir(), "root")
	require.Nil(t, err)
	defer os.RemoveAll(rootDir)
	runSteps(t, s, rootDir)

	validateFileExists(t, rootDir, "src/ent/generated/user_base.ts")
	validateFileExists(t, rootDir, "src/ent/user.ts")
	validateFileExists(t, rootDir, "src/ent/generated/types.ts")
	validateFileExists(t, rootDir, "src/ent/internal.ts")
	validateFileExists(t, rootDir, "src/ent/index.ts")
	validateFileExists(t, rootDir, "src/ent/generated/loadAny.ts")
	validateFileExists(t, rootDir, "src/ent/generated/patterns/feedback_target_query_base.ts")
	validateFileExists(t, rootDir, "src/ent/patterns/query/object_to_likes_query.ts")
	validateFileExists(t, rootDir, "src/ent/user/query/user_to_likes_query.ts")
	validateFileExists(t, rootDir, "src/graphql/generated/resolvers/user_type.ts")
	validateFileExists(t, rootDir, "src/graphql/resolvers/node_query_type.ts")
	validateFileExists(t, rootDir, "src/graphql/generated/resolvers/query_type.ts")
	validateFileExists(t, rootDir, "src/graphql/resolvers/internal.ts")
	validateFileExists(t, rootDir, "src/graphql/resolvers/index.ts")
	validateFileExists(t, rootDir, "src/graphql/generated/schema.ts")
	validateFileExists(t, rootDir, "src/graphql/index.ts")
}

func TestCustomInputType(t *testing.T) {
	s, err := schema.ParseFromInputSchema(&codegenapi.DummyConfig{},
		&input.Schema{
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

	rootDir, err := os.MkdirTemp(os.TempDir(), "root")
	require.Nil(t, err)
	defer os.RemoveAll(rootDir)

	code := testhelper.GetCodeWithSchema(`
			import {RequestContext} from "{root}";
			import {gqlMutation, gqlInputObjectType, gqlField} from "{graphql}";

			@gqlInputObjectType({
			  name: "EmailAvailableArg",
			})
			export class EmailAvailableInput {
				@gqlField({
					class: "EmailAvailableInput",
					type: "String",
				})
				email: string;

				constructor(email: string) {
					this.email = email;
				}
			}

			export class AuthResolver {
			  @gqlMutation({ 
					class: "AuthResolver", 
					name: "emailAvailable", 
					type: Boolean, 
					async: true, 
					args: [
						{
							name: "input",
							type:	'EmailAvailableInput',		
						},
					],
				})
			  async emailAvailableMutation(input: EmailAvailableInput) {
					return false;
				}
		  }
		`)

	mutationsDir := filepath.Join(rootDir, "src", "graphql", "mutations", "auth")
	require.NoError(t, os.MkdirAll(mutationsDir, os.ModePerm))

	filePath := filepath.Join(mutationsDir, "auth.ts")
	require.NoError(t, os.WriteFile(filePath, []byte(code), os.ModePerm))

	runSteps(t, s, rootDir)

	validateFileExists(t, rootDir, "src/ent/generated/user_base.ts")
	validateFileExists(t, rootDir, "src/ent/user.ts")
	validateFileExists(t, rootDir, "src/ent/generated/types.ts")
	validateFileExists(t, rootDir, "src/ent/internal.ts")
	validateFileExists(t, rootDir, "src/ent/index.ts")
	validateFileExists(t, rootDir, "src/ent/generated/loadAny.ts")
	validateFileExists(t, rootDir, "src/graphql/generated/resolvers/user_type.ts")
	validateFileExists(t, rootDir, "src/graphql/resolvers/node_query_type.ts")
	validateFileExists(t, rootDir, "src/graphql/generated/resolvers/query_type.ts")
	validateFileExists(t, rootDir, "src/graphql/resolvers/internal.ts")
	validateFileExists(t, rootDir, "src/graphql/resolvers/index.ts")
	validateFileExists(t, rootDir, "src/graphql/generated/schema.ts")
	validateFileExists(t, rootDir, "src/graphql/index.ts")

	f := path.Join(rootDir, "src/ent/generated/user_base.ts")
	b, err := os.ReadFile(f)
	require.Nil(t, err)
	str := string(b)
	assert.True(
		t,
		strings.HasPrefix(
			str,
			"// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.\n",
		),
	)

	// TODO would like to run tsc but can't because no dependencies installed
	// is there any other way to check for no local errors?
	// runTSC(t, rootDir)

	// schema.gql correctly generated with the input type
	validateLineExistsInFile(t, rootDir, "src/graphql/generated/schema.gql", "emailAvailable(input: EmailAvailableArg!): Boolean!")
}

func runTSC(t *testing.T, dirPath string) {
	require.Nil(t, os.WriteFile(filepath.Join(dirPath, "tsconfig.json"), []byte(`
{
  "compilerOptions": {
    "lib": ["es2018", "esnext.asynciterable"],
    "outDir": "./dist",
    "target": "es2020",
    "module": "commonjs",
    "downlevelIteration": true,
    "baseUrl": ".",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "tests/**/*"]
}
`), os.ModePerm))

	cmd := exec.Command("tsc")
	cmd.Dir = dirPath

	err := cmd.Run()
	if err != nil {
		spew.Dump(err.Error())
	}
	require.Nil(t, err)
}

func validateFileExists(t *testing.T, root, path string) {
	path = filepath.Join(root, path)
	fi, err := os.Stat(path)
	require.Nil(t, err)
	assert.False(t, fi.IsDir())
}

func validateFileDoesNotExist(t *testing.T, root, path string) {
	path = filepath.Join(root, path)
	_, err := os.Stat(path)
	require.Error(t, err)
	require.True(t, os.IsNotExist(err))
}

func validateLineExistsInFile(t *testing.T, root, path, expected string) {
	path = filepath.Join(root, path)
	fi, err := os.Stat(path)
	require.Nil(t, err)
	assert.False(t, fi.IsDir())

	b, err := os.ReadFile(path)
	require.Nil(t, err)
	str := string(b)
	for _, line := range strings.Split(str, "\n") {
		line = strings.TrimSpace(line)
		if expected == line {
			return
		}
		spew.Dump(line)
	}
	assert.Fail(t, "line %s not found", expected)
}
