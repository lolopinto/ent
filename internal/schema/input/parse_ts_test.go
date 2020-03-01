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
	dbType          input.DBType
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
				"user.ts": getCodeWithSchema(`
				import { DBType } from "{schema}";

				const User = {
				fields: [
					{
						name: 'FirstName',
						type: {
							dbType: DBType.String,
						},
					},
				]
			};

			export default User`),
			},
			expectedOutput: map[string]node{
				"User": node{
					fields: []field{
						field{
							name:   "FirstName",
							dbType: input.String,
						},
					},
				},
			},
		},
		"node with explicit schema": testCase{
			code: map[string]string{
				"address.ts": getCodeWithSchema(`
				import Schema, {Field} from "{schema}";
				import {StringType} from "{field}";

				export default class Address implements Schema {
					tableName: string = "addresses";

					fields: Field[] = [
						StringType({name: "street_name"}),
						StringType({name: "city"}),
					]
				}`),
			},
			expectedOutput: map[string]node{
				"Address": node{
					tableName: "addresses",
					fields: []field{
						field{
							name:   "street_name",
							dbType: input.String,
						},
						field{
							name:   "city",
							dbType: input.String,
						},
					},
				},
			},
		},
		"nullable field": testCase{
			code: map[string]string{
				"user.ts": getCodeWithSchema(`
				import Schema, {Field} from "{schema}"
				import {StringType} from "{field}";

				export default class User implements Schema {
					fields: Field[] = [
						StringType({name: "bio", nullable: true}),
					]
				}`),
			},
			expectedOutput: map[string]node{
				"User": node{
					fields: []field{
						field{
							name:     "bio",
							dbType:   input.String,
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
				import {StringType} from "{field}";

				export default class User implements Schema {
					fields: Field[] = [
						StringType({name: "bio", storageKey: "about_me"}),
					]
				}`),
			},
			expectedOutput: map[string]node{
				"User": node{
					fields: []field{
						field{
							name:       "bio",
							dbType:     input.String,
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
				import {StringType} from "{field}";

				export default class User implements Schema {
					fields: Field[] = [
						StringType({name: "bio", graphqlName: "aboutMe"}),
					]
				}`),
			},
			expectedOutput: map[string]node{
				"User": node{
					fields: []field{
						field{
							name:        "bio",
							dbType:      input.String,
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
				import {StringType} from "{field}";

				export default class User implements Schema {
					fields: Field[] = [
						StringType({name: "email", unique: true}),
					]
				}`),
			},
			expectedOutput: map[string]node{
				"User": node{
					fields: []field{
						field{
							name:   "email",
							dbType: input.String,
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
				import {StringType} from "{field}";

				export default class User implements Schema {
					fields: Field[] = [
						StringType({name: "password", hideFromGraphQL: true}),
					]
				}`),
			},
			expectedOutput: map[string]node{
				"User": node{
					fields: []field{
						field{
							name:            "password",
							dbType:          input.String,
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
				import {StringType} from "{field}";

				export default class User implements Schema {
					fields: Field[] = [
						StringType({name: "password", private: true}),
					]
				}`),
			},
			expectedOutput: map[string]node{
				"User": node{
					fields: []field{
						field{
							name:    "password",
							dbType:  input.String,
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
				import {StringType} from "{field}";

				export default class User implements Schema {
					fields: Field[] = [
						StringType({name: "last_name", index: true}),
					]
				}`),
			},
			expectedOutput: map[string]node{
				"User": node{
					fields: []field{
						field{
							name:   "last_name",
							dbType: input.String,
							index:  true,
						},
					},
				},
			},
		},
		"multiple files/complicated": testCase{
			code: map[string]string{
				"user.ts": getCodeWithSchema(`
				import Schema, {Field} from "{schema}"
				import {UUIDType, StringType} from "{field}";

				export default class User implements Schema {
					fields: Field[] = [
						UUIDType({name: "id"}),
						StringType({name: "first_name"}),
						StringType({name: "last_name"}),
						StringType({name: "email", unique: true}),
						StringType({name: "password", private: true, hideFromGraphQL: true}),
					]
				}`),
				"event.ts": getCodeWithSchema(`
				import Schema, {Field} from "{schema}"
				import {TimeType, StringType, UUIDType} from "{field}";

				export default class Event implements Schema {
					fields: Field[] = [
						StringType({name: "name"}),
						UUIDType({name: "creator_id", foreignKey: ["User", "id"]}),
						TimeType({name: "start_time"}),
						TimeType({name: "end_time", nullable: true}),
						StringType({name: "location"}),
					]
				}`),
			},
			expectedOutput: map[string]node{
				"User": node{
					fields: []field{
						// TODO id will come from Node later
						// for now need it for foreign key
						field{
							name:   "id",
							dbType: input.UUID,
						},
						field{
							name:   "first_name",
							dbType: input.String,
						},
						field{
							name:   "last_name",
							dbType: input.String,
						},
						field{
							name:   "email",
							dbType: input.String,
							unique: true,
						},
						field{
							name:            "password",
							dbType:          input.String,
							private:         true,
							hideFromGraphQL: true,
						},
					},
				},
				"Event": node{
					fields: []field{
						field{
							name:   "name",
							dbType: input.String,
						},
						field{
							name:       "creator_id",
							dbType:     input.UUID,
							foreignKey: [2]string{"User", "id"},
						},
						field{
							name:   "start_time",
							dbType: input.Time,
						},
						field{
							name:     "end_time",
							dbType:   input.Time,
							nullable: true,
						},
						field{
							name:   "location",
							dbType: input.String,
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

					assert.Equal(t, expField.dbType, field.Type.DBType)
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
	schemaPath := input.GetAbsoluteSchemaPath()
	fieldPath := strings.Replace(schemaPath, "schema", "field", 1)

	r := strings.NewReplacer("{schema}", schemaPath, "{field}", fieldPath)
	return r.Replace(code)
}
