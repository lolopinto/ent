package input_test

import (
	"testing"

	"github.com/lolopinto/ent/internal/schema/input"
	"github.com/lolopinto/ent/internal/tsimport"
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
				import {Schema, FieldMap, StringType} from "{schema}";

				export default class Address implements Schema {
					tableName: string = "addresses";

					fields: FieldMap = {
						street_name: StringType(),
						city: StringType(),
					}
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
				import {Schema, FieldMap, StringType} from "{schema}";

				export default class User implements Schema {
					fields: FieldMap = {
						bio: StringType({nullable: true}),
					};
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
				import {Schema, FieldMap, StringType} from "{schema}";

				export default class User implements Schema {
					fields: FieldMap = {
						bio: StringType({storageKey: "about_me"}),
					}
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
				import {Schema, FieldMap, StringType} from "{schema}";

				export default class User implements Schema {
					fields: FieldMap = {
						bio: StringType({graphqlName: "aboutMe"}),
					}
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
				import {Schema, FieldMap, StringType} from "{schema}";

				export default class User implements Schema {
					fields: FieldMap = {
						email: StringType({unique: true}),
					};
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
				import {Schema, FieldMap, StringType} from "{schema}";

				export default class User implements Schema {
					fields: FieldMap = {
						password: StringType({hideFromGraphQL: true}),
					};
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
				import {Schema, FieldMap, StringType} from "{schema}";

				export default class User implements Schema {
					fields: FieldMap = {
						password: StringType({private: true}),
					};
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
				import {Schema, FieldMap, StringType} from "{schema}";

				export default class User implements Schema {
					fields: FieldMap = {
						last_name: StringType({index: true}),
					}
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
				import {Schema, FieldMap, TimestampType} from "{schema}";

				export default class User implements Schema {
					fields: FieldMap = {
						updated_at: TimestampType({serverDefault: 'now()'}),
					}
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
				import {Schema, FieldMap, BaseEntSchema, StringType} from "{schema}";

				export default class User extends BaseEntSchema implements Schema {
					fields: FieldMap = {
						firstName: StringType(),
					};
				}`),
			},
			expectedPatterns: map[string]pattern{
				"node": {
					name:   "node",
					fields: nodeFields(),
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
				import {Schema, FieldMap, BaseEntSchema, UUIDType, StringType } from "{schema}"

				export default class User extends BaseEntSchema implements Schema {
					fields: FieldMap = {
						first_name: StringType(),
						last_name: StringType(),
						email: StringType({unique: true}),
						password: StringType({private: true, hideFromGraphQL: true}),
					};
				}`),
				"event.ts": getCodeWithSchema(`
				import {Schema, BaseEntSchema, FieldMap, TimestampType, StringType, UUIDType} from "{schema}"

				export default class Event extends BaseEntSchema implements Schema {
					fields: FieldMap = {
						name: StringType(),
						creator_id: UUIDType({foreignKey: {schema:"User", column:"ID"}}),
						start_time: TimestampType(),
						end_time: TimestampType({ nullable: true}),
						location: StringType(),
					};
				}`),
			},
			expectedPatterns: map[string]pattern{
				"node": {
					name:   "node",
					fields: nodeFields(),
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
				import {Schema, FieldMap, EnumType} from "{schema}";

				export default class User implements Schema {
					fields: FieldMap = {
						AccountStatus: EnumType({values: ["UNVERIFIED", "VERIFIED", "DEACTIVATED", "DISABLED"]}),
					};
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
							},
						},
					},
				},
			},
		},
		"enum with custom type": {
			code: map[string]string{
				"request.ts": getCodeWithSchema(`
				import {Schema, FieldMap, EnumType} from "{schema}";

				export default class Request implements Schema {
					fields: FieldMap = {
						Status: EnumType({values: ["OPEN", "PENDING", "CLOSED"], tsType: "RequestStatus", graphQLType: "RequestStatus"}),
					};
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
				import {Schema, FieldMap, EnumType} from "{schema}";

				export default class Request implements Schema {
					fields: FieldMap = {
						Status: EnumType({values: ["OPEN", "PENDING", "CLOSED"], tsType: "RequestStatus", graphQLType: "RequestStatus", createEnumType: true}),
					}
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
				import {Schema, FieldMap, EnumType} from "{schema}";

				export default class Request implements Schema {
					fields: FieldMap = {
						Status: EnumType({values: ["OPEN", "PENDING", "CLOSED"], createEnumType: true}),
					}
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
							},
						},
					},
				},
			},
		},
		"polymorphic field": {
			code: map[string]string{
				"address.ts": getCodeWithSchema(`
					import {Schema, FieldMap, StringType, UUIDType} from "{schema}";

					export default class Address implements Schema {
						fields: FieldMap = {
							Street: StringType(),
					    City: StringType(),
							State: StringType(),
							ZipCode: StringType(), 
							OwnerID: UUIDType({
								index: true, 
								polymorphic: true,
							}),
						};
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
					import {Schema, FieldMap, StringType, UUIDType} from "{schema}";

					export default class Address implements Schema {
						fields: FieldMap = {
							street: StringType(),
					    city: StringType(),
							state: StringType(),
							zip_code: StringType(), 
							owner_id: UUIDType({
								index: true, 
								polymorphic: {
									types: ["User", "Location"],
									hideFromInverseGraphQL:true,
								},
							}),
						};
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
				import {Schema, FieldMap, BaseEntSchema, UUIDType, StringType } from "{schema}"

				export default class User extends BaseEntSchema implements Schema {
					fields: FieldMap = {
						first_name: StringType(),
						last_name: StringType(),
						email: StringType({ unique: true}),
					};
				}`),
				"event.ts": getCodeWithSchema(`
				import {Schema, BaseEntSchema, FieldMap, TimestampType, StringType, UUIDType} from "{schema}"

				export default class Event extends BaseEntSchema implements Schema {
					fields: FieldMap = {
						name: StringType(),
						creator_id: UUIDType({foreignKey: {schema:"User", column:"ID", disableIndex: true}}),
					}
				}`),
			},
			expectedPatterns: map[string]pattern{
				"node": {
					name:   "node",
					fields: nodeFields(),
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
		"jsonb import ype": {
			code: map[string]string{
				"user.ts": getCodeWithSchema(`
				import {Schema, Field, BaseEntSchema, JSONBType } from "{schema}"

				export default class User extends BaseEntSchema implements Schema {
					fields: Field[] = [
						JSONBType({name: "foo", importType: {
							type: "Foo",
							path: "path/to_foo.ts",
						} }),
					]
				}`),
			},
			expectedPatterns: map[string]pattern{
				"node": {
					name:   "node",
					fields: nodeFields(),
				},
			},
			expectedNodes: map[string]node{
				"User": {
					fields: fieldsWithNodeFields(
						field{
							name:   "foo",
							dbType: input.JSONB,
							typ: &input.FieldType{
								DBType: input.JSONB,
								ImportType: &tsimport.ImportPath{
									ImportPath: "path/to_foo.ts",
									Import:     "Foo",
								},
							},
						},
					),
				},
			},
		},
	}

	runTestCases(t, testCases)
}
