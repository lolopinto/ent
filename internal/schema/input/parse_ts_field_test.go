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
			expectedNodes: map[string]node{
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
			expectedNodes: map[string]node{
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
			expectedNodes: map[string]node{
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
			expectedNodes: map[string]node{
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
			expectedNodes: map[string]node{
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
			expectedNodes: map[string]node{
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
			expectedNodes: map[string]node{
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
			expectedNodes: map[string]node{
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
			expectedNodes: map[string]node{
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
				import {Schema, Field, TimestampType} from "{schema}";

				export default class User implements Schema {
					fields: Field[] = [
						TimestampType({name: "updated_at", serverDefault: 'now()'}),
					]
				}`),
			},
			expectedNodes: map[string]node{
				"User": {
					fields: []field{
						{
							name:          "updated_at",
							dbType:        input.Timestamp,
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
			expectedPatterns: map[string]pattern{
				"node": {
					name: "node",
				},
			},
			expectedNodes: map[string]node{
				"User": {
					fields: fieldsWithNodeFields(
						field{
							name:   "firstName",
							dbType: input.String,
						},
					),
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
				import {Schema, BaseEntSchema, Field, TimestampType, StringType, UUIDType} from "{schema}"

				export default class Event extends BaseEntSchema implements Schema {
					fields: Field[] = [
						StringType({name: "name"}),
						UUIDType({name: "creator_id", foreignKey: {schema:"User", column:"ID"}}),
						TimestampType({name: "start_time"}),
						TimestampType({name: "end_time", nullable: true}),
						StringType({name: "location"}),
					]
				}`),
			},
			expectedPatterns: map[string]pattern{
				"node": {
					name: "node",
				},
			},
			expectedNodes: map[string]node{
				"User": {
					fields: fieldsWithNodeFields(
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
					),
				},
				"Event": {
					fields: fieldsWithNodeFields(
						field{
							name:   "name",
							dbType: input.String,
						},
						field{
							name:       "creator_id",
							dbType:     input.UUID,
							foreignKey: &input.ForeignKey{Schema: "User", Column: "ID"},
						},
						field{
							name:   "start_time",
							dbType: input.Timestamp,
						},
						field{
							name:     "end_time",
							dbType:   input.Timestamp,
							nullable: true,
						},
						field{
							name:   "location",
							dbType: input.String,
						},
					),
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
			expectedNodes: map[string]node{
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
			expectedNodes: map[string]node{
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
			expectedNodes: map[string]node{
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
			expectedNodes: map[string]node{
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
		"polymorphic field": {
			code: map[string]string{
				"address.ts": getCodeWithSchema(`
					import {Schema, Field, StringType, UUIDType} from "{schema}";

					export default class Address implements Schema {
						fields: Field[] = [
							StringType({ name: "Street" }),
					    StringType({ name: "City" }),
							StringType({ name: "State" }),
							StringType({ name: "ZipCode" }), 
							UUIDType({
								name: "OwnerID",
								index: true, 
								polymorphic: true,
							}),
						];
					}
				`),
			},
			expectedNodes: map[string]node{
				"Address": {
					fields: []field{
						{
							name: "Street",
							typ: &input.FieldType{
								DBType: input.String,
							},
						},
						{
							name: "City",
							typ: &input.FieldType{
								DBType: input.String,
							},
						},
						{
							name: "State",
							typ: &input.FieldType{
								DBType: input.String,
							},
						},
						{
							name: "ZipCode",
							typ: &input.FieldType{
								DBType: input.String,
							},
						},
						{
							name: "OwnerID",
							typ: &input.FieldType{
								DBType: input.UUID,
							},
							index:       true,
							polymorphic: &input.PolymorphicOptions{},
							derivedFields: []field{
								{
									name:            "OwnerType",
									dbType:          input.String,
									hideFromGraphQL: true,
								},
							},
						},
					},
				},
			},
		},
		"polymorphic field with restricted types": {
			code: map[string]string{
				"address.ts": getCodeWithSchema(`
					import {Schema, Field, StringType, UUIDType} from "{schema}";

					export default class Address implements Schema {
						fields: Field[] = [
							StringType({ name: "street" }),
					    StringType({ name: "city" }),
							StringType({ name: "state" }),
							StringType({ name: "zip_code" }), 
							UUIDType({
								name: "owner_id",
								index: true, 
								polymorphic: {
									types: ["User", "Location"],
									hideFromInverseGraphQL:true,
								},
							}),
						];
					}
				`),
			},
			expectedNodes: map[string]node{
				"Address": {
					fields: []field{
						{
							name: "street",
							typ: &input.FieldType{
								DBType: input.String,
							},
						},
						{
							name: "city",
							typ: &input.FieldType{
								DBType: input.String,
							},
						},
						{
							name: "state",
							typ: &input.FieldType{
								DBType: input.String,
							},
						},
						{
							name: "zip_code",
							typ: &input.FieldType{
								DBType: input.String,
							},
						},
						{
							name: "owner_id",
							typ: &input.FieldType{
								DBType: input.UUID,
							},
							index: true,
							polymorphic: &input.PolymorphicOptions{
								Types:                  []string{"User", "Location"},
								HideFromInverseGraphQL: true,
							},
							derivedFields: []field{
								{
									name: "owner_type",
									typ: &input.FieldType{
										DBType: input.StringEnum,
										Values: []string{
											"User",
											"Location",
										},
										Type:        "owner_type",
										GraphQLType: "owner_type",
									},
									hideFromGraphQL: true,
								},
							},
						},
					},
				},
			},
		},
		"disable index in foreign key": {
			code: map[string]string{
				"user.ts": getCodeWithSchema(`
				import {Schema, Field, BaseEntSchema, UUIDType, StringType } from "{schema}"

				export default class User extends BaseEntSchema implements Schema {
					fields: Field[] = [
						StringType({name: "first_name"}),
						StringType({name: "last_name"}),
						StringType({name: "email", unique: true}),
					]
				}`),
				"event.ts": getCodeWithSchema(`
				import {Schema, BaseEntSchema, Field, TimestampType, StringType, UUIDType} from "{schema}"

				export default class Event extends BaseEntSchema implements Schema {
					fields: Field[] = [
						StringType({name: "name"}),
						UUIDType({name: "creator_id", foreignKey: {schema:"User", column:"ID", disableIndex: true}}),
					]
				}`),
			},
			expectedPatterns: map[string]pattern{
				"node": {
					name: "node",
				},
			},
			expectedNodes: map[string]node{
				"User": {
					fields: fieldsWithNodeFields(
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
					),
				},
				"Event": {
					fields: fieldsWithNodeFields(
						field{
							name:   "name",
							dbType: input.String,
						},
						field{
							name:       "creator_id",
							dbType:     input.UUID,
							foreignKey: &input.ForeignKey{Schema: "User", Column: "ID", DisableIndex: true},
						},
					),
				},
			},
		},
	}

	runTestCases(t, testCases)
}
