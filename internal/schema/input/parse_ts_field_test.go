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
				import {EntSchema, StringType} from "{schema}";

				const User = new EntSchema({
					fields: {
						bio: StringType({nullable: true}),
					},
				});
				export default User;
				`),
			},
			expectedNodes: map[string]node{
				"User": {
					fields: fieldsWithNodeFields(field{
						name:     "bio",
						dbType:   input.String,
						nullable: true,
					}),
				},
			},
		},
		"renamed storageKey": {
			code: map[string]string{
				"user.ts": getCodeWithSchema(`
				import {EntSchema, StringType} from "{schema}";

				const User = new EntSchema({
					fields: {
						bio: StringType({storageKey: "about_me"}),
					},
				});
				export default User;
				`),
			},
			expectedNodes: map[string]node{
				"User": {
					fields: fieldsWithNodeFields(field{
						name:       "bio",
						dbType:     input.String,
						storageKey: "about_me",
					}),
				},
			},
		},
		"renamed graphqlName": {
			code: map[string]string{
				"user.ts": getCodeWithSchema(`
				import {EntSchema, StringType} from "{schema}";

				const User = new EntSchema({
					fields: {
						bio: StringType({graphqlName: "aboutMe"}),
					},
				});
				export default User;`),
			},
			expectedNodes: map[string]node{
				"User": {
					fields: fieldsWithNodeFields(field{
						name:        "bio",
						dbType:      input.String,
						graphqlName: "aboutMe",
					},
					),
				},
			},
		},
		"unique": {
			code: map[string]string{
				"user.ts": getCodeWithSchema(`
				import {StringType} from "{schema}";

				const UserSchema = new EntSchema({
					fields: {
						email: StringType({unique: true}),
					},
				});
				export default UserSchema;`),
			},
			expectedNodes: map[string]node{
				"User": {
					fields: fieldsWithNodeFields(field{
						name:   "email",
						dbType: input.String,
						unique: true,
					},
					),
				},
			},
		},
		"hideFromGraphQL": {
			code: map[string]string{
				"user.ts": getCodeWithSchema(`
				import {EntSchema, StringType} from "{schema}";

				const UserSchema = new EntSchema({
					fields: {
						password: StringType({hideFromGraphQL: true}),
					},
				});
				export default UserSchema;`),
			},
			expectedNodes: map[string]node{
				"User": {
					fields: fieldsWithNodeFields(field{
						name:            "password",
						dbType:          input.String,
						hideFromGraphQL: true,
					}),
				},
			},
		},
		"private field": {
			code: map[string]string{
				"user.ts": getCodeWithSchema(`
				import {EntSchema, StringType} from "{schema}";

				const UserSchema = new EntSchema({
					fields: {
						password: StringType({private: true}),
					},
				});
				export default UserSchema;`),
			},
			expectedNodes: map[string]node{
				"User": {
					fields: fieldsWithNodeFields(field{
						name:    "password",
						dbType:  input.String,
						private: &input.PrivateOptions{},
					}),
				},
			},
		},
		"private field exposed to actions": {
			code: map[string]string{
				"user.ts": getCodeWithSchema(`
				import {EntSchema, StringType} from "{schema}";

				const UserSchema = new EntSchema({
					fields: {
						password: StringType({private: {
							exposeToActions: true,
						}}),
					},
				});
				export default UserSchema;`),
			},
			expectedNodes: map[string]node{
				"User": {
					fields: fieldsWithNodeFields(field{
						name:   "password",
						dbType: input.String,
						private: &input.PrivateOptions{
							ExposeToActions: true,
						},
					}),
				},
			},
		},
		"index": {
			code: map[string]string{
				"user.ts": getCodeWithSchema(`
				import {EntSchema, StringType} from "{schema}";

				const User = new EntSchema({
					fields: {
						last_name: StringType({index: true}),
					},
				});
				export default User;`),
			},
			expectedNodes: map[string]node{
				"User": {
					fields: fieldsWithNodeFields(field{
						name:   "last_name",
						dbType: input.String,
						index:  true,
					}),
				},
			},
		},
		"server default": {
			code: map[string]string{
				"user.ts": getCodeWithSchema(`
				import {EntSchema, TimestampType} from "{schema}";

				const User = new EntSchema({
					fields: {
						updated_at: TimestampType({serverDefault: 'now()'}),
					},
				});
				export default User;`),
			},
			expectedNodes: map[string]node{
				"User": {
					fields: fieldsWithNodeFields(field{
						name:          "updated_at",
						dbType:        input.Timestamp,
						serverDefault: "now()",
					}),
				},
			},
		},
		"multiple files/complicated": {
			code: map[string]string{
				"user_schema.ts": getCodeWithSchema(`
				import {EntSchema, UUIDType, StringType } from "{schema}"

				const UserSchema = new EntSchema({
					fields: {
						first_name: StringType(),
						last_name: StringType(),
						email: StringType({unique: true}),
						password: StringType({private: true, hideFromGraphQL: true}),
					},
				});
				export default UserSchema;`),
				"event_schema.ts": getCodeWithSchema(`
				import {EntSchema, TimestampType, StringType, UUIDType} from "{schema}"

				const EventSchema = new EntSchema({
					fields: {
						name: StringType(),
						creator_id: UUIDType({foreignKey: {schema:"User", column:"ID"}}),
						start_time: TimestampType(),
						end_time: TimestampType({ nullable: true}),
						location: StringType(),
					},
				});
				export default EventSchema;`),
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
							private:         &input.PrivateOptions{},
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
				import {EntSchema, EnumType} from "{schema}";

				const UserSchema = new EntSchema({
					fields: {
						AccountStatus: EnumType({values: ["UNVERIFIED", "VERIFIED", "DEACTIVATED", "DISABLED"]}),
					},
				});
				export default UserSchema`),
			},
			expectedNodes: map[string]node{
				"User": {
					fields: fieldsWithNodeFields(field{
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
					}),
				},
			},
		},
		"enum with custom type": {
			code: map[string]string{
				"request_schema.ts": getCodeWithSchema(`
				import {EntSchema, EnumType} from "{schema}";

				const RequestSchema = new EntSchema({
					fields: {
						Status: EnumType({values: ["OPEN", "PENDING", "CLOSED"], tsType: "RequestStatus", graphQLType: "RequestStatus"}),
					},
				});
				export default RequestSchema;`),
			},
			expectedNodes: map[string]node{
				"Request": {
					fields: fieldsWithNodeFields(field{
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
					}),
				},
			},
		},
		"db enum with custom type": {
			code: map[string]string{
				"request_schema.ts": getCodeWithSchema(`
				import {EntSchema, EnumType} from "{schema}";

				const RequestSchema = new EntSchema({
					fields: {
						Status: EnumType({values: ["OPEN", "PENDING", "CLOSED"], tsType: "RequestStatus", graphQLType: "RequestStatus", createEnumType: true}),
					},
				});
				export default RequestSchema;`),
			},
			expectedNodes: map[string]node{
				"Request": {
					fields: fieldsWithNodeFields(field{
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
					}),
				},
			},
		},
		"db enum": {
			code: map[string]string{
				"request.ts": getCodeWithSchema(`
				import {EntSchema, EnumType} from "{schema}";

				const RequestSchema = new EntSchema({
					fields: {
						Status: EnumType({values: ["OPEN", "PENDING", "CLOSED"], createEnumType: true}),
					},
				});
				export default RequestSchema;`),
			},
			expectedNodes: map[string]node{
				"Request": {
					fields: fieldsWithNodeFields(field{
						name: "Status",
						typ: &input.FieldType{
							DBType: input.Enum,
							Values: []string{
								"OPEN",
								"PENDING",
								"CLOSED",
							},
						},
					}),
				},
			},
		},
		"polymorphic field": {
			code: map[string]string{
				"address.ts": getCodeWithSchema(`
					import {EntSchema, StringType, UUIDType} from "{schema}";

					const AddressSchema = new EntSchema({
						fields: {
							Street: StringType(),
					    City: StringType(),
							State: StringType(),
							ZipCode: StringType(), 
							OwnerID: UUIDType({
								index: true, 
								polymorphic: true,
							}),
						},
					});
					export default AddressSchema;
				`),
			},
			expectedNodes: map[string]node{
				"Address": {
					fields: fieldsWithNodeFields(
						field{
							name: "Street",
							typ: &input.FieldType{
								DBType: input.String,
							},
						},
						field{
							name: "City",
							typ: &input.FieldType{
								DBType: input.String,
							},
						},
						field{
							name: "State",
							typ: &input.FieldType{
								DBType: input.String,
							},
						},
						field{
							name: "ZipCode",
							typ: &input.FieldType{
								DBType: input.String,
							},
						},
						field{
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
					),
				},
			},
		},
		"polymorphic field with restricted types": {
			code: map[string]string{
				"address.ts": getCodeWithSchema(`
					import {EntSchema, StringType, UUIDType} from "{schema}";

					const AddressSchema = new EntSchema({
						fields: {
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
						},
					});
					export default AddressSchema;
				`),
			},
			expectedNodes: map[string]node{
				"Address": {
					fields: fieldsWithNodeFields(
						field{
							name: "street",
							typ: &input.FieldType{
								DBType: input.String,
							},
						},
						field{
							name: "city",
							typ: &input.FieldType{
								DBType: input.String,
							},
						},
						field{
							name: "state",
							typ: &input.FieldType{
								DBType: input.String,
							},
						},
						field{
							name: "zip_code",
							typ: &input.FieldType{
								DBType: input.String,
							},
						},
						field{
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
					),
				},
			},
		},
		"disable index in foreign key": {
			code: map[string]string{
				"user_schema.ts": getCodeWithSchema(`
				import {EntSchema, UUIDType, StringType } from "{schema}"

				const UserSchema = new EntSchema({
					fields: {
						first_name: StringType(),
						last_name: StringType(),
						email: StringType({ unique: true}),
					},
				});
				export default UserSchema;`),
				"event_schema.ts": getCodeWithSchema(`
				import {EntSchema, TimestampType, StringType, UUIDType} from "{schema}"

				const EventSchema = new EntSchema({
					fields: {
						name: StringType(),
						creator_id: UUIDType({foreignKey: {schema:"User", column:"ID", disableIndex: true}}),
					},
				});
				export default EventSchema;`),
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
		"jsonb import type": {
			code: map[string]string{
				"user_schema.ts": getCodeWithSchema(`
				import {EntSchema, JSONBType } from "{schema}"

				const UserSchema = new EntSchema({
					fields: {
						foo: JSONBType({
							importType: {
								type: "Foo",
								path: "path/to_foo.ts",
							},
						}),
					},
				});
				export default UserSchema;`),
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
		"jsonb import type as list": {
			code: map[string]string{
				"user.ts": getCodeWithSchema(`
				import {EntSchema, JSONBTypeAsList } from "{schema}"

				const UserSchema = new EntSchema({
					fields: {
						foo: JSONBTypeAsList({importType: {
							type: "Foo",
							path: "path/to_foo.ts",
						} }),
					},
				});
				export default UserSchema;`),
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
								ListElemType: &input.FieldType{
									DBType: input.JSONB,
								},
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
		"struct type as list": {
			only: true,
			code: map[string]string{
				"user.ts": getCodeWithSchema(`
				import { EntSchema, StructTypeAsList, StringType, IntegerType } from "{schema}"

				const UserSchema = new EntSchema({
					fields: {
						foo: StructTypeAsList({
							tsType: 'FooType',
							graphQLType: 'FooType',
							fields: {
								bar: StringType(),
								baz: IntegerType(),
							},
						}),
					}
				});
				export default UserSchema;
				`),
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
								Type:        "FooType",
								GraphQLType: "FooType",
								DBType:      input.JSONB,
								ListElemType: &input.FieldType{
									DBType: input.JSONB,
								},
								SubFields: []*input.Field{
									{
										Name: "bar",
										Type: &input.FieldType{
											DBType: input.String,
										},
									},
									{
										Name: "baz",
										Type: &input.FieldType{
											DBType: input.Int,
										},
									},
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
