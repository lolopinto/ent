package input_test

import (
	"testing"

	"github.com/lolopinto/ent/internal/schema/input"
)

func TestParseFields(t *testing.T) {
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
				import Schema, {Field} from "{schema}";
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
				import Schema, {Field} from "{schema}";
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
				import Schema, {Field} from "{schema}";
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
				import Schema, {Field} from "{schema}";
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
				import Schema, {Field} from "{schema}";
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
				import Schema, {Field} from "{schema}";
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
				import Schema, {Field} from "{schema}";
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
		"server default": testCase{
			code: map[string]string{
				"user.ts": getCodeWithSchema(`
				import Schema, {Field} from "{schema}";
				import {TimeType} from "{field}";

				export default class User implements Schema {
					fields: Field[] = [
						TimeType({name: "updated_at", serverDefault: 'now()'}),
					]
				}`),
			},
			expectedOutput: map[string]node{
				"User": node{
					fields: []field{
						field{
							name:          "updated_at",
							dbType:        input.Time,
							serverDefault: "now()",
						},
					},
				},
			},
		},
		"with base schema": testCase{
			code: map[string]string{
				"user.ts": getCodeWithSchema(`
				import Schema, {Field, BaseEntSchema} from "{schema}";
				import {StringType} from "{field}";

				export default class User extends BaseEntSchema implements Schema {
					fields: Field[] = [
						StringType({name: "firstName"}),
					];
				}`),
			},
			expectedOutput: map[string]node{
				"User": node{
					fields: []field{
						field{
							name:       "ID",
							dbType:     input.UUID,
							primaryKey: true,
						},
						field{
							name:            "createdAt",
							dbType:          input.Time,
							hideFromGraphQL: true,
						},
						field{
							name:            "updatedAt",
							dbType:          input.Time,
							hideFromGraphQL: true,
						},
						field{
							name:   "firstName",
							dbType: input.String,
						},
					},
				},
			},
		},
		"multiple files/complicated": testCase{
			code: map[string]string{
				"user.ts": getCodeWithSchema(`
				import Schema, {Field, BaseEntSchema} from "{schema}"
				import {UUIDType, StringType} from "{field}";

				export default class User extends BaseEntSchema implements Schema {
					fields: Field[] = [
						StringType({name: "first_name"}),
						StringType({name: "last_name"}),
						StringType({name: "email", unique: true}),
						StringType({name: "password", private: true, hideFromGraphQL: true}),
					]
				}`),
				"event.ts": getCodeWithSchema(`
				import Schema, {BaseEntSchema, Field} from "{schema}"
				import {TimeType, StringType, UUIDType} from "{field}";

				export default class Event extends BaseEntSchema implements Schema {
					fields: Field[] = [
						StringType({name: "name"}),
						UUIDType({name: "creator_id", foreignKey: ["User", "ID"]}),
						TimeType({name: "start_time"}),
						TimeType({name: "end_time", nullable: true}),
						StringType({name: "location"}),
					]
				}`),
			},
			expectedOutput: map[string]node{
				"User": node{
					fields: []field{
						field{
							name:       "ID",
							dbType:     input.UUID,
							primaryKey: true,
						},
						field{
							name:            "createdAt",
							dbType:          input.Time,
							hideFromGraphQL: true,
						},
						field{
							name:            "updatedAt",
							dbType:          input.Time,
							hideFromGraphQL: true,
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
							name:       "ID",
							dbType:     input.UUID,
							primaryKey: true,
						},
						field{
							name:            "createdAt",
							dbType:          input.Time,
							hideFromGraphQL: true,
						},
						field{
							name:            "updatedAt",
							dbType:          input.Time,
							hideFromGraphQL: true,
						},
						field{
							name:   "name",
							dbType: input.String,
						},
						field{
							name:       "creator_id",
							dbType:     input.UUID,
							foreignKey: &[2]string{"User", "ID"},
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

	runTestCases(t, testCases)
}
