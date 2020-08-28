package input_test

import (
	"testing"

	"github.com/lolopinto/ent/internal/schema/input"
)

func TestParseFields(t *testing.T) {
	testCases := map[string]testCase{
		"node with implicit schema": {
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
				"User": {
					fields: []field{
						{
							name:   "FirstName",
							dbType: input.String,
						},
					},
				},
			},
		},
		"node with explicit schema": {
			code: map[string]string{
				"address.ts": getCodeWithSchema(`
				import {Schema, Field, StringType} from "{schema}";

				export default class Address implements Schema {
					tableName: string = "addresses";

					fields: Field[] = [
						StringType({name: "street_name"}),
						StringType({name: "city"}),
					]
				}`),
			},
			expectedOutput: map[string]node{
				"Address": {
					tableName: "addresses",
					fields: []field{
						{
							name:   "street_name",
							dbType: input.String,
						},
						{
							name:   "city",
							dbType: input.String,
						},
					},
				},
			},
		},
		"nullable field": {
			code: map[string]string{
				"user.ts": getCodeWithSchema(`
				import {Schema, Field, StringType} from "{schema}";

				export default class User implements Schema {
					fields: Field[] = [
						StringType({name: "bio", nullable: true}),
					]
				}`),
			},
			expectedOutput: map[string]node{
				"User": {
					fields: []field{
						{
							name:     "bio",
							dbType:   input.String,
							nullable: true,
						},
					},
				},
			},
		},
		"renamed storageKey": {
			code: map[string]string{
				"user.ts": getCodeWithSchema(`
				import {Schema, Field, StringType} from "{schema}";

				export default class User implements Schema {
					fields: Field[] = [
						StringType({name: "bio", storageKey: "about_me"}),
					]
				}`),
			},
			expectedOutput: map[string]node{
				"User": {
					fields: []field{
						{
							name:       "bio",
							dbType:     input.String,
							storageKey: "about_me",
						},
					},
				},
			},
		},
		"renamed graphqlName": {
			code: map[string]string{
				"user.ts": getCodeWithSchema(`
				import {Schema, Field, StringType} from "{schema}";

				export default class User implements Schema {
					fields: Field[] = [
						StringType({name: "bio", graphqlName: "aboutMe"}),
					]
				}`),
			},
			expectedOutput: map[string]node{
				"User": {
					fields: []field{
						{
							name:        "bio",
							dbType:      input.String,
							graphqlName: "aboutMe",
						},
					},
				},
			},
		},
		"unique": {
			code: map[string]string{
				"user.ts": getCodeWithSchema(`
				import {Schema, Field, StringType} from "{schema}";

				export default class User implements Schema {
					fields: Field[] = [
						StringType({name: "email", unique: true}),
					]
				}`),
			},
			expectedOutput: map[string]node{
				"User": {
					fields: []field{
						{
							name:   "email",
							dbType: input.String,
							unique: true,
						},
					},
				},
			},
		},
		"hideFromGraphQL": {
			code: map[string]string{
				"user.ts": getCodeWithSchema(`
				import {Schema, Field, StringType} from "{schema}";

				export default class User implements Schema {
					fields: Field[] = [
						StringType({name: "password", hideFromGraphQL: true}),
					]
				}`),
			},
			expectedOutput: map[string]node{
				"User": {
					fields: []field{
						{
							name:            "password",
							dbType:          input.String,
							hideFromGraphQL: true,
						},
					},
				},
			},
		},
		"private field": {
			code: map[string]string{
				"user.ts": getCodeWithSchema(`
				import {Schema, Field, StringType} from "{schema}";

				export default class User implements Schema {
					fields: Field[] = [
						StringType({name: "password", private: true}),
					]
				}`),
			},
			expectedOutput: map[string]node{
				"User": {
					fields: []field{
						{
							name:    "password",
							dbType:  input.String,
							private: true,
						},
					},
				},
			},
		},
		"index": {
			code: map[string]string{
				"user.ts": getCodeWithSchema(`
				import {Schema, Field, StringType} from "{schema}";

				export default class User implements Schema {
					fields: Field[] = [
						StringType({name: "last_name", index: true}),
					]
				}`),
			},
			expectedOutput: map[string]node{
				"User": {
					fields: []field{
						{
							name:   "last_name",
							dbType: input.String,
							index:  true,
						},
					},
				},
			},
		},
		"server default": {
			code: map[string]string{
				"user.ts": getCodeWithSchema(`
				import {Schema, Field, TimeType} from "{schema}";

				export default class User implements Schema {
					fields: Field[] = [
						TimeType({name: "updated_at", serverDefault: 'now()'}),
					]
				}`),
			},
			expectedOutput: map[string]node{
				"User": {
					fields: []field{
						{
							name:          "updated_at",
							dbType:        input.Time,
							serverDefault: "now()",
						},
					},
				},
			},
		},
		"with base schema": {
			code: map[string]string{
				"user.ts": getCodeWithSchema(`
				import {Schema, Field, BaseEntSchema, StringType} from "{schema}";

				export default class User extends BaseEntSchema implements Schema {
					fields: Field[] = [
						StringType({name: "firstName"}),
					];
				}`),
			},
			expectedOutput: map[string]node{
				"User": {
					fields: []field{
						{
							name:                    "ID",
							dbType:                  input.UUID,
							primaryKey:              true,
							disableUserEditable:     true,
							hasDefaultValueOnCreate: true,
						},
						{
							name:                    "createdAt",
							dbType:                  input.Time,
							hideFromGraphQL:         true,
							disableUserEditable:     true,
							hasDefaultValueOnCreate: true,
						},
						{
							name:                    "updatedAt",
							dbType:                  input.Time,
							hideFromGraphQL:         true,
							disableUserEditable:     true,
							hasDefaultValueOnCreate: true,
							hasDefaultValueOnEdit:   true,
						},
						{
							name:   "firstName",
							dbType: input.String,
						},
					},
				},
			},
		},
		"multiple files/complicated": {
			code: map[string]string{
				"user.ts": getCodeWithSchema(`
				import {Schema, Field, BaseEntSchema, UUIDType, StringType } from "{schema}"

				export default class User extends BaseEntSchema implements Schema {
					fields: Field[] = [
						StringType({name: "first_name"}),
						StringType({name: "last_name"}),
						StringType({name: "email", unique: true}),
						StringType({name: "password", private: true, hideFromGraphQL: true}),
					]
				}`),
				"event.ts": getCodeWithSchema(`
				import {Schema, BaseEntSchema, Field, TimeType, StringType, UUIDType} from "{schema}"

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
				"User": {
					fields: []field{
						{
							name:                    "ID",
							dbType:                  input.UUID,
							primaryKey:              true,
							disableUserEditable:     true,
							hasDefaultValueOnCreate: true,
						},
						{
							name:                    "createdAt",
							dbType:                  input.Time,
							hideFromGraphQL:         true,
							disableUserEditable:     true,
							hasDefaultValueOnCreate: true,
						},
						{
							name:                    "updatedAt",
							dbType:                  input.Time,
							hideFromGraphQL:         true,
							disableUserEditable:     true,
							hasDefaultValueOnCreate: true,
							hasDefaultValueOnEdit:   true,
						},
						{
							name:   "first_name",
							dbType: input.String,
						},
						{
							name:   "last_name",
							dbType: input.String,
						},
						{
							name:   "email",
							dbType: input.String,
							unique: true,
						},
						{
							name:            "password",
							dbType:          input.String,
							private:         true,
							hideFromGraphQL: true,
						},
					},
				},
				"Event": {
					fields: []field{
						{
							name:                    "ID",
							dbType:                  input.UUID,
							primaryKey:              true,
							disableUserEditable:     true,
							hasDefaultValueOnCreate: true,
						},
						{
							name:                    "createdAt",
							dbType:                  input.Time,
							hideFromGraphQL:         true,
							disableUserEditable:     true,
							hasDefaultValueOnCreate: true,
						},
						{
							name:                    "updatedAt",
							dbType:                  input.Time,
							hideFromGraphQL:         true,
							disableUserEditable:     true,
							hasDefaultValueOnCreate: true,
							hasDefaultValueOnEdit:   true,
						},
						{
							name:   "name",
							dbType: input.String,
						},
						{
							name:       "creator_id",
							dbType:     input.UUID,
							foreignKey: &[2]string{"User", "ID"},
						},
						{
							name:   "start_time",
							dbType: input.Time,
						},
						{
							name:     "end_time",
							dbType:   input.Time,
							nullable: true,
						},
						{
							name:   "location",
							dbType: input.String,
						},
					},
				},
			},
		},
		"enum": {
			code: map[string]string{
				"user.ts": getCodeWithSchema(`
				import {Schema, Field, EnumType} from "{schema}";

				export default class User implements Schema {
					fields: Field[] = [
						EnumType({name: "AccountStatus", values: ["UNVERIFIED", "VERIFIED", "DEACTIVATED", "DISABLED"]}),
					]
				}`),
			},
			expectedOutput: map[string]node{
				"User": {
					fields: []field{
						{
							name: "AccountStatus",
							typ: &input.FieldType{
								DBType: input.StringEnum,
								Values: []string{
									"UNVERIFIED",
									"VERIFIED",
									"DEACTIVATED",
									"DISABLED",
								},
								Type:        "AccountStatus",
								GraphQLType: "AccountStatus",
							},
						},
					},
				},
			},
		},
		"enum with custom type": {
			code: map[string]string{
				"request.ts": getCodeWithSchema(`
				import {Schema, Field, EnumType} from "{schema}";

				export default class Request implements Schema {
					fields: Field[] = [
						EnumType({name: "Status", values: ["OPEN", "PENDING", "CLOSED"], tsType: "RequestStatus", graphQLType: "RequestStatus"}),
					]
				}`),
			},
			expectedOutput: map[string]node{
				"Request": {
					fields: []field{
						{
							name: "Status",
							typ: &input.FieldType{
								DBType: input.StringEnum,
								Values: []string{
									"OPEN",
									"PENDING",
									"CLOSED",
								},
								Type:        "RequestStatus",
								GraphQLType: "RequestStatus",
							},
						},
					},
				},
			},
		},
		"db enum with custom type": {
			code: map[string]string{
				"request.ts": getCodeWithSchema(`
				import {Schema, Field, EnumType} from "{schema}";

				export default class Request implements Schema {
					fields: Field[] = [
						EnumType({name: "Status", values: ["OPEN", "PENDING", "CLOSED"], tsType: "RequestStatus", graphQLType: "RequestStatus", createEnumType: true}),
					]
				}`),
			},
			expectedOutput: map[string]node{
				"Request": {
					fields: []field{
						{
							name: "Status",
							typ: &input.FieldType{
								DBType: input.Enum,
								Values: []string{
									"OPEN",
									"PENDING",
									"CLOSED",
								},
								Type:        "RequestStatus",
								GraphQLType: "RequestStatus",
							},
						},
					},
				},
			},
		},
		"db enum ": {
			code: map[string]string{
				"request.ts": getCodeWithSchema(`
				import {Schema, Field, EnumType} from "{schema}";

				export default class Request implements Schema {
					fields: Field[] = [
						EnumType({name: "Status", values: ["OPEN", "PENDING", "CLOSED"], createEnumType: true}),
					]
				}`),
			},
			expectedOutput: map[string]node{
				"Request": {
					fields: []field{
						{
							name: "Status",
							typ: &input.FieldType{
								DBType: input.Enum,
								Values: []string{
									"OPEN",
									"PENDING",
									"CLOSED",
								},
								Type:        "Status",
								GraphQLType: "Status",
							},
						},
					},
				},
			},
		},
	}

	runTestCases(t, testCases)
}
