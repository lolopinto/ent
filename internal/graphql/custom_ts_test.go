package graphql

import (
	"io/ioutil"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/codepath"
	"github.com/lolopinto/ent/internal/schema/base"
	"github.com/lolopinto/ent/internal/schema/testhelper"
	"github.com/lolopinto/ent/internal/tsimport"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func getCodePath(t *testing.T, dirPath string) *codegen.Config {
	codepath, err := codegen.NewConfig(filepath.Join(dirPath, "src/schema"), "")
	require.Nil(t, err)
	return codepath
}

func validateDefaultCustomTypes(t *testing.T, customData *CustomData) {
	// GraphQLJSON and GraphQLTime
	require.GreaterOrEqual(t, len(customData.CustomTypes), 2)

	json := customData.CustomTypes["GraphQLJSON"]
	require.NotNil(t, json)
	assert.Equal(t, json.Type, "GraphQLJSON")
	assert.Equal(t, json.ImportPath, "graphql-type-json")
	assert.NotNil(t, json.ScalarInfo)

	time := customData.CustomTypes["GraphQLTime"]
	require.NotNil(t, time)
	assert.Equal(t, time.Type, "GraphQLTime")
	assert.Equal(t, time.ImportPath, "../graphql/scalars/time")
	assert.NotNil(t, time.ScalarInfo)
}

func TestCustomMutation(t *testing.T) {
	// simple test that just tests the entire flow.
	// very complicated but simplest no-frills way to test things
	m := map[string]string{
		"contact.ts": testhelper.GetCodeWithSchema(`
			import {BaseEntSchema, FieldMap, StringType} from "{schema}";

			export default class Contact extends BaseEntSchema {
				fields: FieldMap = {
					firstName: StringType(),
					lastName: StringType(),
				};
			}
		`),
	}

	absPath, err := filepath.Abs(".")
	require.NoError(t, err)
	dirPath, err := ioutil.TempDir(absPath, "project")
	defer os.RemoveAll(dirPath)
	require.NoError(t, err)

	schema := testhelper.ParseSchemaForTest(t, m, base.TypeScript, testhelper.TempDir(dirPath))
	data := &codegen.Processor{
		Schema: schema,
		Config: getCodePath(t, dirPath),
	}

	schemaDir := filepath.Join(dirPath, "src", "graphql", "mutations", "auth")
	require.NoError(t, os.MkdirAll(schemaDir, os.ModePerm))

	code := testhelper.GetCodeWithSchema(`
			import {RequestContext} from "{root}";
			import {gqlMutation, gqlArg} from "{graphql}";

			export class AuthResolver {
			  @gqlMutation({ name: "emailAvailable", type: Boolean })
			  async emailAvailableMutation(@gqlArg("email") email: string) {
					return false;
				}
		  }
		`)

	path := filepath.Join(schemaDir, "auth.ts")
	require.NoError(t, ioutil.WriteFile(path, []byte(code), os.ModePerm))

	s, err := buildSchema(data, true)
	require.NoError(t, err)

	require.Len(t, s.customData.Args, 0)
	require.Len(t, s.customData.Inputs, 0)
	require.Len(t, s.customData.Objects, 0)
	require.Len(t, s.customData.Fields, 0)
	require.Len(t, s.customData.Queries, 0)
	require.Len(t, s.customData.Mutations, 1)
	require.Len(t, s.customData.Classes, 1)
	require.Len(t, s.customData.Files, 1)
	validateDefaultCustomTypes(t, s.customData)

	item := s.customData.Mutations[0]
	assert.Equal(t, item.Node, "AuthResolver")
	assert.Equal(t, item.GraphQLName, "emailAvailable")
	assert.Equal(t, item.FunctionName, "emailAvailableMutation")
	assert.Equal(t, item.FieldType, AsyncFunction)

	require.Len(t, item.Args, 1)
	arg := item.Args[0]
	assert.Equal(t, arg.Name, "email")
	assert.Equal(t, arg.Type, "String")
	assert.Equal(t, arg.Nullable, NullableItem(""))
	assert.Equal(t, arg.List, false)
	assert.Equal(t, arg.IsContextArg, false)
	assert.Equal(t, arg.TSType, "string")

	require.Len(t, item.Results, 1)
	result := item.Results[0]
	assert.Equal(t, result.Name, "")
	assert.Equal(t, result.Type, "Boolean")
	assert.Equal(t, result.Nullable, NullableItem(""))
	assert.Equal(t, result.List, false)
	assert.Equal(t, result.IsContextArg, false)
	assert.Equal(t, result.TSType, "boolean")

	require.Len(t, s.customQueries, 0)
	require.Len(t, s.customMutations, 1)

	gqlNode := s.customMutations[0]
	assert.Len(t, gqlNode.connections, 0)
	assert.Len(t, gqlNode.ActionDependents, 0)
	assert.Equal(t, gqlNode.Field, &item)
	assert.True(t, strings.HasSuffix(gqlNode.FilePath, "src/graphql/generated/mutations/email_available_type.ts"))

	objData := gqlNode.ObjData
	require.NotNil(t, objData)
	assert.Nil(t, objData.NodeData)
	assert.Equal(t, objData.Node, "AuthResolver")
	assert.Equal(t, objData.NodeInstance, "obj")
	assert.Len(t, objData.Enums, 0)
	assert.Len(t, objData.GQLNodes, 0)

	fcfg := objData.FieldConfig
	require.NotNil(t, fcfg)

	assert.True(t, fcfg.Exported)
	assert.Equal(t, fcfg.Name, "EmailAvailableType")
	assert.Equal(t, fcfg.Arg, "emailAvailableArgs")
	assert.Equal(t, fcfg.ResolveMethodArg, "args")
	assert.Equal(t, fcfg.ReturnTypeHint, "")
	assert.Equal(t, fcfg.TypeImports, []*tsimport.ImportPath{
		tsimport.NewGQLClassImportPath("GraphQLNonNull"),
		tsimport.NewGQLImportPath("GraphQLBoolean"),
	})
	assert.Equal(t, fcfg.ArgImports, []*tsimport.ImportPath{
		{
			Import:     "AuthResolver",
			ImportPath: "../../mutations/auth/auth",
		},
	})
	assert.Equal(t, fcfg.Args, []*fieldConfigArg{
		{
			Name: "email",
			Imports: []*tsimport.ImportPath{
				tsimport.NewGQLClassImportPath("GraphQLNonNull"),
				tsimport.NewGQLImportPath("GraphQLString"),
			},
		},
	})
	assert.Equal(t, fcfg.FunctionContents, []string{
		"const r = new AuthResolver();",
		"return r.emailAvailableMutation(args.email);",
	})
}

func TestCustomQuery(t *testing.T) {
	m := map[string]string{
		"contact.ts": testhelper.GetCodeWithSchema(`
			import {BaseEntSchema, FieldMap, StringType} from "{schema}";

			export default class Contact extends BaseEntSchema {
				fields: FieldMap = {
					firstName: StringType(),
					lastName: StringType(),
				};
			}
		`),
	}

	absPath, err := filepath.Abs(".")
	require.NoError(t, err)
	dirPath, err := ioutil.TempDir(absPath, "project")
	defer os.RemoveAll(dirPath)
	require.NoError(t, err)

	schema := testhelper.ParseSchemaForTest(t, m, base.TypeScript, testhelper.TempDir(dirPath))
	data := &codegen.Processor{
		Schema: schema,
		Config: getCodePath(t, dirPath),
	}

	schemaDir := filepath.Join(dirPath, "src", "graphql", "resolvers", "auth")
	require.NoError(t, os.MkdirAll(schemaDir, os.ModePerm))

	code := testhelper.GetCodeWithSchema(`
			import {RequestContext} from "{root}";
			import {gqlQuery, gqlArg} from "{graphql}";

			export class AuthResolver {
			  @gqlQuery({ name: "emailAvailable", type: Boolean })
			  async emailAvailable(@gqlArg("email") email: string) {
					return false;
				}
		  }
		`)

	path := filepath.Join(schemaDir, "auth.ts")
	require.NoError(t, ioutil.WriteFile(path, []byte(code), os.ModePerm))

	s, err := buildSchema(data, true)
	require.NoError(t, err)

	require.Len(t, s.customData.Args, 0)
	require.Len(t, s.customData.Inputs, 0)
	require.Len(t, s.customData.Objects, 0)
	require.Len(t, s.customData.Fields, 0)
	require.Len(t, s.customData.Queries, 1)
	require.Len(t, s.customData.Mutations, 0)
	require.Len(t, s.customData.Classes, 1)
	require.Len(t, s.customData.Files, 1)
	validateDefaultCustomTypes(t, s.customData)

	item := s.customData.Queries[0]
	assert.Equal(t, item.Node, "AuthResolver")
	assert.Equal(t, item.GraphQLName, "emailAvailable")
	assert.Equal(t, item.FunctionName, "emailAvailable")
	assert.Equal(t, item.FieldType, AsyncFunction)

	require.Len(t, item.Args, 1)
	arg := item.Args[0]
	assert.Equal(t, arg.Name, "email")
	assert.Equal(t, arg.Type, "String")
	assert.Equal(t, arg.Nullable, NullableItem(""))
	assert.Equal(t, arg.List, false)
	assert.Equal(t, arg.IsContextArg, false)
	assert.Equal(t, arg.TSType, "string")

	require.Len(t, item.Results, 1)
	result := item.Results[0]
	assert.Equal(t, result.Name, "")
	assert.Equal(t, result.Type, "Boolean")
	assert.Equal(t, result.Nullable, NullableItem(""))
	assert.Equal(t, result.List, false)
	assert.Equal(t, result.IsContextArg, false)
	assert.Equal(t, result.TSType, "boolean")

	require.Len(t, s.customQueries, 1)
	require.Len(t, s.customMutations, 0)

	gqlNode := s.customQueries[0]
	assert.Len(t, gqlNode.connections, 0)
	assert.Len(t, gqlNode.ActionDependents, 0)
	assert.Equal(t, gqlNode.Field, &item)
	assert.True(t, strings.HasSuffix(gqlNode.FilePath, "src/graphql/generated/resolvers/email_available_query_type.ts"))

	objData := gqlNode.ObjData
	require.NotNil(t, objData)
	assert.Nil(t, objData.NodeData)
	assert.Equal(t, objData.Node, "AuthResolver")
	assert.Equal(t, objData.NodeInstance, "obj")
	assert.Len(t, objData.Enums, 0)
	assert.Len(t, objData.GQLNodes, 0)

	fcfg := objData.FieldConfig
	require.NotNil(t, fcfg)

	assert.True(t, fcfg.Exported)
	assert.Equal(t, fcfg.Name, "EmailAvailableQueryType")
	assert.Equal(t, fcfg.Arg, "emailAvailableArgs")
	assert.Equal(t, fcfg.ResolveMethodArg, "args")
	assert.Equal(t, fcfg.ReturnTypeHint, "")
	assert.Equal(t, fcfg.TypeImports, []*tsimport.ImportPath{
		tsimport.NewGQLClassImportPath("GraphQLNonNull"),
		tsimport.NewGQLImportPath("GraphQLBoolean"),
	})
	assert.Equal(t, fcfg.ArgImports, []*tsimport.ImportPath{
		{
			Import:     "AuthResolver",
			ImportPath: "../../resolvers/auth/auth",
		},
	})
	assert.Equal(t, fcfg.Args, []*fieldConfigArg{
		{
			Name: "email",
			Imports: []*tsimport.ImportPath{
				tsimport.NewGQLClassImportPath("GraphQLNonNull"),
				tsimport.NewGQLImportPath("GraphQLString"),
			},
		},
	})
	assert.Equal(t, fcfg.FunctionContents, []string{
		"const r = new AuthResolver();",
		"return r.emailAvailable(args.email);",
	})
}

func TestCustomListQuery(t *testing.T) {
	m := map[string]string{}

	absPath, err := filepath.Abs(".")
	require.NoError(t, err)
	dirPath, err := ioutil.TempDir(absPath, "project")
	defer os.RemoveAll(dirPath)
	require.NoError(t, err)

	schema := testhelper.ParseSchemaForTest(t, m, base.TypeScript, testhelper.TempDir(dirPath))
	data := &codegen.Processor{
		Schema: schema,
		Config: getCodePath(t, dirPath),
	}

	schemaDir := filepath.Join(dirPath, "src", "graphql", "resolvers", "auth")
	require.NoError(t, os.MkdirAll(schemaDir, os.ModePerm))

	code := testhelper.GetCodeWithSchema(`
			import {RequestContext} from "{root}";
			import {gqlQuery, gqlArg} from "{graphql}";

			export class AuthResolver {
			  @gqlQuery({ name: "emailsAvailable", type: [Boolean] })
			  async emailsAvailable(@gqlArg("emails", {type: [String]}) emails: string[]) {
					const arr = new Array(emails.length);
					return arr.fill(false);
				}
		  }
		`)

	path := filepath.Join(schemaDir, "auth.ts")
	require.NoError(t, ioutil.WriteFile(path, []byte(code), os.ModePerm))

	s, err := buildSchema(data, true)
	require.NoError(t, err)

	require.Len(t, s.customData.Args, 0)
	require.Len(t, s.customData.Inputs, 0)
	require.Len(t, s.customData.Objects, 0)
	require.Len(t, s.customData.Fields, 0)
	require.Len(t, s.customData.Queries, 1)
	require.Len(t, s.customData.Mutations, 0)
	require.Len(t, s.customData.Classes, 1)
	require.Len(t, s.customData.Files, 1)
	validateDefaultCustomTypes(t, s.customData)

	item := s.customData.Queries[0]
	assert.Equal(t, item.Node, "AuthResolver")
	assert.Equal(t, item.GraphQLName, "emailsAvailable")
	assert.Equal(t, item.FunctionName, "emailsAvailable")
	assert.Equal(t, item.FieldType, AsyncFunction)

	require.Len(t, item.Args, 1)
	arg := item.Args[0]
	assert.Equal(t, arg.Name, "emails")
	assert.Equal(t, arg.Type, "String")
	assert.Equal(t, arg.Nullable, NullableItem(""))
	assert.Equal(t, arg.List, true)
	assert.Equal(t, arg.IsContextArg, false)
	assert.Equal(t, arg.TSType, "string")

	require.Len(t, item.Results, 1)
	result := item.Results[0]
	assert.Equal(t, result.Name, "")
	assert.Equal(t, result.Type, "Boolean")
	assert.Equal(t, result.Nullable, NullableItem(""))
	assert.Equal(t, result.List, true)
	assert.Equal(t, result.IsContextArg, false)
	assert.Equal(t, result.TSType, "boolean")

	require.Len(t, s.customQueries, 1)
	require.Len(t, s.customMutations, 0)

	gqlNode := s.customQueries[0]
	assert.Len(t, gqlNode.connections, 0)
	assert.Len(t, gqlNode.ActionDependents, 0)
	assert.Equal(t, gqlNode.Field, &item)
	assert.True(t, strings.HasSuffix(gqlNode.FilePath, "src/graphql/generated/resolvers/emails_available_query_type.ts"))

	objData := gqlNode.ObjData
	require.NotNil(t, objData)
	assert.Nil(t, objData.NodeData)
	assert.Equal(t, objData.Node, "AuthResolver")
	assert.Equal(t, objData.NodeInstance, "obj")
	assert.Len(t, objData.Enums, 0)
	assert.Len(t, objData.GQLNodes, 0)

	fcfg := objData.FieldConfig
	require.NotNil(t, fcfg)

	assert.True(t, fcfg.Exported)
	assert.Equal(t, fcfg.Name, "EmailsAvailableQueryType")
	assert.Equal(t, fcfg.Arg, "emailsAvailableArgs")
	assert.Equal(t, fcfg.ResolveMethodArg, "args")
	assert.Equal(t, fcfg.ReturnTypeHint, "")
	assert.Equal(t, fcfg.TypeImports, []*tsimport.ImportPath{
		tsimport.NewGQLClassImportPath("GraphQLNonNull"),
		tsimport.NewGQLClassImportPath("GraphQLList"),
		tsimport.NewGQLClassImportPath("GraphQLNonNull"),
		tsimport.NewGQLImportPath("GraphQLBoolean"),
	})
	assert.Equal(t, fcfg.ArgImports, []*tsimport.ImportPath{
		{
			Import:     "AuthResolver",
			ImportPath: "../../resolvers/auth/auth",
		},
	})
	assert.Equal(t, fcfg.Args, []*fieldConfigArg{
		{
			Name: "emails",
			Imports: []*tsimport.ImportPath{
				tsimport.NewGQLClassImportPath("GraphQLNonNull"),
				tsimport.NewGQLClassImportPath("GraphQLList"),
				tsimport.NewGQLClassImportPath("GraphQLNonNull"),
				tsimport.NewGQLImportPath("GraphQLString"),
			},
		},
	})
	assert.Equal(t, fcfg.FunctionContents, []string{
		"const r = new AuthResolver();",
		"return r.emailsAvailable(args.emails);",
	})
}

func TestCustomQueryReferencesExistingObject(t *testing.T) {
	m := map[string]string{
		"user.ts": testhelper.GetCodeWithSchema(`
			import {BaseEntSchema, FieldMap, StringType} from "{schema}";

			export default class User extends BaseEntSchema {
				fields: FieldMap = {
					firstName: StringType(),
					lastName: StringType(),
				};
			}
		`),
		"username.ts": testhelper.GetCodeWithSchema(`
			import {BaseEntSchema, FieldMap, StringType, UUIDType} from "{schema}";

			export default class Username extends BaseEntSchema {
				fields: FieldMap = {
					username: StringType({
						unique:true,
					}),
					userID: UUIDType({
						foreignKey: {schema: "User", column: "ID"},
					}),
				};
			}
		`),
	}

	absPath, err := filepath.Abs(".")
	require.NoError(t, err)
	dirPath, err := ioutil.TempDir(absPath, "project")
	defer os.RemoveAll(dirPath)
	require.NoError(t, err)

	schema := testhelper.ParseSchemaForTest(t, m, base.TypeScript, testhelper.TempDir(dirPath))
	data := &codegen.Processor{
		Schema: schema,
		Config: getCodePath(t, dirPath),
	}

	schemaDir := filepath.Join(dirPath, "src", "graphql", "resolvers", "username")
	require.NoError(t, os.MkdirAll(schemaDir, os.ModePerm))

	code := testhelper.GetCodeWithSchema(`
			import {RequestContext} from "{root}";
			import {gqlQuery, gqlArg} from "{graphql}";

			export class UsernameResolver {
			  @gqlQuery({ name: "username", type: "User", nullable:true })
			  async username(@gqlArg("username") username: string) {
					// not actually typed here so fine
					return null;
				}
		  }
		`)

	path := filepath.Join(schemaDir, "username.ts")
	require.NoError(t, ioutil.WriteFile(path, []byte(code), os.ModePerm))

	s, err := buildSchema(data, true)
	require.NoError(t, err)

	require.Len(t, s.customData.Args, 0)
	require.Len(t, s.customData.Inputs, 0)
	require.Len(t, s.customData.Objects, 0)
	require.Len(t, s.customData.Fields, 0)
	require.Len(t, s.customData.Queries, 1)
	require.Len(t, s.customData.Mutations, 0)
	require.Len(t, s.customData.Classes, 1)
	require.Len(t, s.customData.Files, 1)
	validateDefaultCustomTypes(t, s.customData)

	item := s.customData.Queries[0]
	assert.Equal(t, item.Node, "UsernameResolver")
	assert.Equal(t, item.GraphQLName, "username")
	assert.Equal(t, item.FunctionName, "username")
	assert.Equal(t, item.FieldType, AsyncFunction)

	require.Len(t, item.Args, 1)
	arg := item.Args[0]
	assert.Equal(t, arg.Name, "username")
	assert.Equal(t, arg.Type, "String")
	assert.Equal(t, arg.Nullable, NullableItem(""))
	assert.Equal(t, arg.List, false)
	assert.Equal(t, arg.IsContextArg, false)
	assert.Equal(t, arg.TSType, "string")

	require.Len(t, item.Results, 1)
	result := item.Results[0]
	assert.Equal(t, result.Name, "")
	assert.Equal(t, result.Type, "User")
	assert.Equal(t, result.Nullable, NullableTrue)
	assert.Equal(t, result.List, false)
	assert.Equal(t, result.IsContextArg, false)
	assert.Equal(t, result.TSType, "")

	require.Len(t, s.customQueries, 1)
	require.Len(t, s.customMutations, 0)

	gqlNode := s.customQueries[0]
	assert.Len(t, gqlNode.connections, 0)
	assert.Len(t, gqlNode.ActionDependents, 0)
	assert.Equal(t, gqlNode.Field, &item)
	assert.True(t, strings.HasSuffix(gqlNode.FilePath, "src/graphql/generated/resolvers/username_query_type.ts"))

	objData := gqlNode.ObjData
	require.NotNil(t, objData)
	assert.Nil(t, objData.NodeData)
	assert.Equal(t, objData.Node, "UsernameResolver")
	assert.Equal(t, objData.NodeInstance, "obj")
	assert.Len(t, objData.Enums, 0)
	assert.Len(t, objData.GQLNodes, 0)

	fcfg := objData.FieldConfig
	require.NotNil(t, fcfg)

	assert.True(t, fcfg.Exported)
	assert.Equal(t, fcfg.Name, "UsernameQueryType")
	assert.Equal(t, fcfg.Arg, "usernameArgs")
	assert.Equal(t, fcfg.ResolveMethodArg, "args")
	assert.Equal(t, fcfg.ReturnTypeHint, "")
	assert.Equal(t, fcfg.TypeImports, []*tsimport.ImportPath{
		{
			ImportPath: codepath.GetImportPathForInternalGQLFile(),
			Import:     "UserType",
		},
	})
	assert.Equal(t, fcfg.ArgImports, []*tsimport.ImportPath{
		{
			Import:     "UsernameResolver",
			ImportPath: "../../resolvers/username/username",
		},
	})
	assert.Equal(t, fcfg.Args, []*fieldConfigArg{
		{
			Name: "username",
			Imports: []*tsimport.ImportPath{
				tsimport.NewGQLClassImportPath("GraphQLNonNull"),
				tsimport.NewGQLImportPath("GraphQLString"),
			},
		},
	})
	assert.Equal(t, fcfg.FunctionContents, []string{
		"const r = new UsernameResolver();",
		"return r.username(args.username);",
	})
}

func TestCustomUploadType(t *testing.T) {
	m := map[string]string{}

	absPath, err := filepath.Abs(".")
	require.NoError(t, err)
	dirPath, err := ioutil.TempDir(absPath, "project")
	defer os.RemoveAll(dirPath)
	require.NoError(t, err)

	schema := testhelper.ParseSchemaForTest(t, m, base.TypeScript, testhelper.TempDir(dirPath))
	data := &codegen.Processor{
		Schema: schema,
		Config: getCodePath(t, dirPath),
	}

	schemaDir := filepath.Join(dirPath, "src", "graphql", "mutations", "file")
	require.NoError(t, os.MkdirAll(schemaDir, os.ModePerm))

	code := testhelper.GetCodeWithSchema(`
			import {RequestContext} from "{root}";
			import {gqlMutation, gqlArg, gqlFileUpload} from "{graphql}";

			export class ProfilePicResolver {
			  @gqlMutation({ name: "profilePicUpload", type: Boolean })
				// TODO TS type
			  async profilePicUpload(@gqlArg("file", {type: gqlFileUpload}) file) {
					return true;
				}
		  }
		`)

	path := filepath.Join(schemaDir, "upload.ts")
	require.NoError(t, ioutil.WriteFile(path, []byte(code), os.ModePerm))

	s, err := buildSchema(data, true)
	require.NoError(t, err)

	require.Len(t, s.customData.Args, 0)
	require.Len(t, s.customData.Inputs, 0)
	require.Len(t, s.customData.Objects, 0)
	require.Len(t, s.customData.Fields, 0)
	require.Len(t, s.customData.Queries, 0)
	require.Len(t, s.customData.Mutations, 1)
	require.Len(t, s.customData.Classes, 1)
	require.Len(t, s.customData.Files, 1)

	item := s.customData.Mutations[0]
	assert.Equal(t, item.Node, "ProfilePicResolver")
	assert.Equal(t, item.GraphQLName, "profilePicUpload")
	assert.Equal(t, item.FunctionName, "profilePicUpload")
	assert.Equal(t, item.FieldType, AsyncFunction)

	require.Len(t, item.Args, 1)
	arg := item.Args[0]
	assert.Equal(t, arg.Name, "file")
	assert.Equal(t, arg.Type, "GraphQLUpload")
	assert.Equal(t, arg.Nullable, NullableItem(""))
	assert.Equal(t, arg.List, false)
	assert.Equal(t, arg.IsContextArg, false)
	assert.Equal(t, arg.TSType, "FileUpload")

	require.Len(t, item.Results, 1)
	result := item.Results[0]
	assert.Equal(t, result.Name, "")
	assert.Equal(t, result.Type, "Boolean")
	assert.Equal(t, result.Nullable, NullableItem(""))
	assert.Equal(t, result.List, false)
	assert.Equal(t, result.IsContextArg, false)
	assert.Equal(t, result.TSType, "boolean")

	require.Len(t, s.customQueries, 0)
	require.Len(t, s.customMutations, 1)

	gqlNode := s.customMutations[0]
	assert.Len(t, gqlNode.connections, 0)
	assert.Len(t, gqlNode.ActionDependents, 0)
	assert.Equal(t, gqlNode.Field, &item)
	assert.True(t, strings.HasSuffix(gqlNode.FilePath, "src/graphql/generated/mutations/profile_pic_upload_type.ts"))

	objData := gqlNode.ObjData
	require.NotNil(t, objData)
	assert.Nil(t, objData.NodeData)
	assert.Equal(t, objData.Node, "ProfilePicResolver")
	assert.Equal(t, objData.NodeInstance, "obj")
	assert.Len(t, objData.Enums, 0)
	assert.Len(t, objData.GQLNodes, 0)

	fcfg := objData.FieldConfig
	require.NotNil(t, fcfg)

	assert.True(t, fcfg.Exported)
	assert.Equal(t, fcfg.Name, "ProfilePicUploadType")
	assert.Equal(t, fcfg.Arg, "profilePicUploadArgs")
	assert.Equal(t, fcfg.ResolveMethodArg, "args")
	assert.Equal(t, fcfg.ReturnTypeHint, "")
	assert.Equal(t, fcfg.TypeImports, []*tsimport.ImportPath{
		tsimport.NewGQLClassImportPath("GraphQLNonNull"),
		tsimport.NewGQLImportPath("GraphQLBoolean"),
	})
	assert.Equal(t, fcfg.ArgImports, []*tsimport.ImportPath{
		{
			Import:     "ProfilePicResolver",
			ImportPath: "../../mutations/file/upload",
		},
	})
	assert.Equal(t, fcfg.Args, []*fieldConfigArg{
		{
			Name: "file",
			Imports: []*tsimport.ImportPath{
				tsimport.NewGQLClassImportPath("GraphQLNonNull"),
				{
					Import:     "GraphQLUpload",
					ImportPath: "graphql-upload",
				},
			},
		},
	})
	assert.Equal(t, fcfg.FunctionContents, []string{
		"const r = new ProfilePicResolver();",
		"return r.profilePicUpload(args.file);",
	})

	validateDefaultCustomTypes(t, s.customData)
	typ := s.customData.CustomTypes["GraphQLUpload"]

	assert.NotNil(t, typ)

	assert.Equal(t, typ.ImportPath, "graphql-upload")
	assert.Equal(t, typ.Type, "GraphQLUpload")
	assert.Equal(t, typ.TSType, "FileUpload")
	assert.Equal(t, typ.TSImportPath, "graphql-upload")
}
