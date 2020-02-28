package input_test

import (
	"io/ioutil"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/lolopinto/ent/internal/schema/input"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type node struct {
	tableName string
	fields    []field
}

type field struct {
	name            string
	typ             string
	nullable        bool
	storageKey      string
	unique          bool
	hideFromGraphQL bool
	private         bool
	graphqlName     string
	index           bool
	foreignKey      [2]string
}

type testCase struct {
	code           map[string]string
	expectedOutput map[string]node
}

func TestParse(t *testing.T) {
	testCases := map[string]testCase{
		"node with implicit schema": testCase{
			code: map[string]string{
				"user.ts": `const User = {
				fields: [
					{
						name: 'FirstName',
						type: 'string',
					},
				]
			};

			export default User`,
			},
			expectedOutput: map[string]node{
				"User": node{
					fields: []field{
						field{
							name: "FirstName",
							typ:  "string",
						},
					},
				},
			},
		},
		"node with explicit schema": testCase{
			code: map[string]string{
				"address.ts": getCodeWithSchema(`
				import Schema, {Field} from "{schema}"

				export default class Address implements Schema {
					tableName: string = "addresses";

					fields: Field[] = [
						{
							name: "street_name",
							type: "string",
						},
						{
							name: "city",
							type: "string",
						},
					]
				}`),
			},
			expectedOutput: map[string]node{
				"Address": node{
					tableName: "addresses",
					fields: []field{
						field{
							name: "street_name",
							typ:  "string",
						},
						field{
							name: "city",
							typ:  "string",
						},
					},
				},
			},
		},
		"nullable field": testCase{
			code: map[string]string{
				"user.ts": getCodeWithSchema(`
				import Schema, {Field} from "{schema}"

				export default class User implements Schema {
					fields: Field[] = [
						{
							name: "bio",
							type: "string",
							nullable: true,
						},
					]
				}`),
			},
			expectedOutput: map[string]node{
				"User": node{
					fields: []field{
						field{
							name:     "bio",
							typ:      "string",
							nullable: true,
						},
					},
				},
			},
		},
		"renamed storageKey": testCase{
			code: map[string]string{
				"user.ts": getCodeWithSchema(`
				import Schema, {Field} from "{schema}"

				export default class User implements Schema {
					fields: Field[] = [
						{
							name: "bio",
							type: "string",
							storageKey: "about_me",
						},
					]
				}`),
			},
			expectedOutput: map[string]node{
				"User": node{
					fields: []field{
						field{
							name:       "bio",
							typ:        "string",
							storageKey: "about_me",
						},
					},
				},
			},
		},
		"renamed graphqlName": testCase{
			code: map[string]string{
				"user.ts": getCodeWithSchema(`
				import Schema, {Field} from "{schema}"

				export default class User implements Schema {
					fields: Field[] = [
						{
							name: "bio",
							type: "string",
							graphqlName: "aboutMe",
						},
					]
				}`),
			},
			expectedOutput: map[string]node{
				"User": node{
					fields: []field{
						field{
							name:        "bio",
							typ:         "string",
							graphqlName: "aboutMe",
						},
					},
				},
			},
		},
		"unique": testCase{
			code: map[string]string{
				"user.ts": getCodeWithSchema(`
				import Schema, {Field} from "{schema}"

				export default class User implements Schema {
					fields: Field[] = [
						{
							name: "email",
							type: "string",
							unique: true,
						},
					]
				}`),
			},
			expectedOutput: map[string]node{
				"User": node{
					fields: []field{
						field{
							name:   "email",
							typ:    "string",
							unique: true,
						},
					},
				},
			},
		},
		"hideFromGraphQL": testCase{
			code: map[string]string{
				"user.ts": getCodeWithSchema(`
				import Schema, {Field} from "{schema}"

				export default class User implements Schema {
					fields: Field[] = [
						{
							name: "password",
							type: "string",
							hideFromGraphQL: true,
						},
					]
				}`),
			},
			expectedOutput: map[string]node{
				"User": node{
					fields: []field{
						field{
							name:            "password",
							typ:             "string",
							hideFromGraphQL: true,
						},
					},
				},
			},
		},
		"private field": testCase{
			code: map[string]string{
				"user.ts": getCodeWithSchema(`
				import Schema, {Field} from "{schema}"

				export default class User implements Schema {
					fields: Field[] = [
						{
							name: "password",
							type: "string",
							private: true,
						},
					]
				}`),
			},
			expectedOutput: map[string]node{
				"User": node{
					fields: []field{
						field{
							name:    "password",
							typ:     "string",
							private: true,
						},
					},
				},
			},
		},
		"index": testCase{
			code: map[string]string{
				"user.ts": getCodeWithSchema(`
				import Schema, {Field} from "{schema}"

				export default class User implements Schema {
					fields: Field[] = [
						{
							name: "last_name",
							type: "string",
							index: true,
						},
					]
				}`),
			},
			expectedOutput: map[string]node{
				"User": node{
					fields: []field{
						field{
							name:  "last_name",
							typ:   "string",
							index: true,
						},
					},
				},
			},
		},
		"multiple files/complicated": testCase{
			code: map[string]string{
				"user.ts": getCodeWithSchema(`
				import Schema, {Field} from "{schema}"

				export default class User implements Schema {
					fields: Field[] = [
						{
							name: "id",
							type: "string",
						},
						{
							name: "first_name",
							type: "string",
						},
						{
							name: "last_name",
							type: "string",
						},
						{
							name: "email",
							type: "string",
							unique: true,
						},
						{
							name: "password",
							type: "string",
							private: true,
							hideFromGraphQL: true,
						},
					]
				}`),
				"event.ts": getCodeWithSchema(`
				import Schema, {Field} from "{schema}"

				export default class Event implements Schema {
					fields: Field[] = [
						{
							name: "name",
							type: "string",
						},
						{
							name: "creator_id",
							type: "string",
							foreignKey: ["User", "id"],
						},
						{
							name: "start_time",
							type: "time",
						},
						{
							name: "end_time",
							type: "time",
							nullable: true,
						},
						{
							name: "location",
							type: "string",
						},
					]
				}`),
			},
			expectedOutput: map[string]node{
				"User": node{
					fields: []field{
						// TODO id will come from Node later
						// for now need it for foreign key
						field{
							name: "id",
							typ:  "string",
						},
						field{
							name: "first_name",
							typ:  "string",
						},
						field{
							name: "last_name",
							typ:  "string",
						},
						field{
							name:   "email",
							typ:    "string",
							unique: true,
						},
						field{
							name:            "password",
							typ:             "string",
							private:         true,
							hideFromGraphQL: true,
						},
					},
				},
				"Event": node{
					fields: []field{
						field{
							name: "name",
							typ:  "string",
						},
						field{
							name:       "creator_id",
							typ:        "string",
							foreignKey: [2]string{"User", "id"},
						},
						field{
							name: "start_time",
							typ:  "time",
						},
						field{
							name:     "end_time",
							typ:      "time",
							nullable: true,
						},
						field{
							name: "location",
							typ:  "string",
						},
					},
				},
			},
		},
	}

	absPath, err := filepath.Abs(".")
	require.NoError(t, err)

	for key, tt := range testCases {
		t.Run(key, func(t *testing.T) {
			dirPath, err := ioutil.TempDir(absPath, "base")
			require.NoError(t, err)

			// delete temporary created file
			defer os.RemoveAll(dirPath)

			schemaDir := filepath.Join(dirPath, "schema")
			require.NoError(t, os.MkdirAll(schemaDir, os.ModePerm))

			for fileName, contents := range tt.code {
				path := filepath.Join(schemaDir, fileName)
				require.NoError(t, ioutil.WriteFile(path, []byte(contents), os.ModePerm))
			}

			schema, err := input.ParseSchemaFromTSDir(dirPath)
			require.NoError(t, err)

			require.NotNil(t, schema)

			require.Len(t, schema.Nodes, len(tt.expectedOutput))

			for nodeName, expectedNode := range tt.expectedOutput {
				node := schema.Nodes[nodeName]

				require.NotNil(t, node, "node with node name %s not found", nodeName)

				assertStrEqual(t, "tableName", expectedNode.tableName, node.TableName)

				for j, expField := range expectedNode.fields {
					field := node.Fields[j]

					assert.Equal(t, expField.typ, field.Type)
					assert.Equal(t, expField.name, field.Name)

					assertStrEqual(t, "storageKey", expField.storageKey, field.StorageKey)

					assertBoolEqual(t, "nullable", expField.nullable, field.Nullable)
					assertBoolEqual(t, "unique", expField.unique, field.Unique)
					assertBoolEqual(t, "hideFromGraphQL", expField.hideFromGraphQL, field.HideFromGraphQL)
					assertBoolEqual(t, "private", expField.private, field.Private)
					assertStrEqual(t, "graphqlName", expField.graphqlName, field.GraphQLName)
					assertBoolEqual(t, "index", expField.index, field.Index)

					assert.Equal(t, expField.foreignKey, field.ForeignKey)
				}
			}
		})
	}
}

func assertStrEqual(t *testing.T, key, expectedValue string, value *string) {
	if expectedValue != "" {
		require.NotNil(t, value, key)
		assert.Equal(t, expectedValue, *value, key)
	} else {
		require.Nil(t, value, key)
	}
}

func assertBoolEqual(t *testing.T, key string, expectedValue bool, value *bool) {
	if expectedValue {
		require.NotNil(t, value, key)
		assert.Equal(t, expectedValue, *value, key)
	} else {
		require.Nil(t, value, key)
	}
}

func getCodeWithSchema(code string) string {
	r := strings.NewReplacer("{schema}", input.GetAbsoluteSchemaPath())
	return r.Replace(code)
}
