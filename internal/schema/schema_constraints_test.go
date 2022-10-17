package schema_test

import (
	"fmt"
	"testing"

	"github.com/lolopinto/ent/internal/schema"
	"github.com/lolopinto/ent/internal/schema/input"
	"github.com/lolopinto/ent/internal/schema/testhelper"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPrimaryKeyFieldConstraint(t *testing.T) {
	testConstraints(
		t,
		map[string]string{
			"user.ts": testhelper.GetCodeWithSchema(
				`import {EntSchema, StringType} from "{schema}";

				const UserSchema = new EntSchema({
					fields: {
						firstName: StringType(),
						lastName: StringType(),
					},
				});
				export default UserSchema;
			`,
			),
		},
		map[string]*schema.NodeData{
			"User": {
				Constraints: constraintsWithNodeConstraints("users"),
			},
		},
		nil,
	)
}

func TestForeignKeyFieldConstraint(t *testing.T) {
	testConstraints(
		t,
		map[string]string{
			"user.ts": testhelper.GetCodeWithSchema(
				`import {StringType, EntSchema} from "{schema}";

				const User = new EntSchema({
					fields: {
						firstName: StringType(),
						lastName: StringType(),
					},
				});
				export default User;
			`,
			),
			"contact.ts": testhelper.GetCodeWithSchema(
				`import {StringType, EntSchema, UUIDType} from "{schema}";

				const Contact = new EntSchema({
					fields: {
						firstName: StringType(),
						lastName: StringType(),
						ownerID: UUIDType({
							foreignKey: {schema:"User", column:"ID"},
						}),
					},
				});
				export default Contact;
			`,
			),
		},
		map[string]*schema.NodeData{
			"User": {
				Constraints: constraintsWithNodeConstraints("users"),
			},
			"Contact": {
				Constraints: constraintsWithNodeConstraints(
					"contacts",
					&input.Constraint{
						Name:    "contacts_owner_id_fkey",
						Type:    input.ForeignKeyConstraint,
						Columns: []string{"owner_id"},
						ForeignKey: &input.ForeignKeyInfo{
							TableName: "users",
							Columns:   []string{"id"},
							OnDelete:  "CASCADE",
						},
					}),
			},
		},
		nil,
	)
}

func TestUniqueFieldConstraint(t *testing.T) {
	testConstraints(
		t,
		map[string]string{
			"user.ts": testhelper.GetCodeWithSchema(
				`import {StringType, EntSchema} from "{schema}";

				const User = new EntSchema({
					fields: {
						firstName: StringType(),
						lastName: StringType(),
						emailAddress: StringType({
							unique: true,
						})
					},
				});
				export default User;
			`,
			),
		},
		map[string]*schema.NodeData{
			"User": {
				Constraints: constraintsWithNodeConstraints("users",
					&input.Constraint{
						Name:    "users_unique_email_address",
						Type:    input.UniqueConstraint,
						Columns: []string{"email_address"},
					},
				),
			},
		},
		nil,
	)
}

func TestConstraints(t *testing.T) {
	testCases := map[string]testCase{
		"multi-column-primary key": {
			code: map[string]string{
				"user_photo.ts": testhelper.GetCodeWithSchema(`
					import {Schema, FieldMap, UUIDType, Constraint, ConstraintType} from "{schema}";

					export default class UserPhoto implements Schema {
						fields: FieldMap = {
							UserID: UUIDType(),
							PhotoID: UUIDType(),
						};

						constraints: Constraint[] = [
							{
								name: "user_photos_pkey",
								type: ConstraintType.PrimaryKey,
								columns: ["UserID", "PhotoID"],
							},
						];
					}
				`),
			},
			expectedMap: map[string]*schema.NodeData{
				"UserPhoto": {
					Constraints: []*input.Constraint{
						{
							Name:    "user_photos_pkey",
							Type:    input.PrimaryKeyConstraint,
							Columns: []string{"user_id", "photo_id"},
						},
					},
				},
			},
		},
		"multi-column-unique key": {
			code: map[string]string{
				"user.ts": testhelper.GetCodeWithSchema(`
					import {StringType, EntSchema} from "{schema}";

					export const User = new EntSchema({
						fields: {
							firstName: StringType(),
							lastName: StringType(),
						},
					});
					export default User;
				`),
				"contact.ts": testhelper.GetCodeWithSchema(`
					import {EntSchema, FieldMap, UUIDType, StringType, Constraint, ConstraintType} from "{schema}";

					const Contact = new EntSchema({
						fields: {
							emailAddress: StringType(),
							userID: UUIDType({
								foreignKey: {schema:"User", column:"ID"},
							}),
						},

						constraints: [
							{
								name: "contacts_unique_email",
								type: ConstraintType.Unique,
								columns: ["emailAddress", "userID"],
							},
						],
					});
					export default Contact;
				`),
			},
			expectedMap: map[string]*schema.NodeData{
				"User": {
					Constraints: constraintsWithNodeConstraints("users"),
				},
				"Contact": {
					Constraints: constraintsWithNodeConstraints("contacts",
						&input.Constraint{
							Name:    "contacts_user_id_fkey",
							Type:    input.ForeignKeyConstraint,
							Columns: []string{"user_id"},
							ForeignKey: &input.ForeignKeyInfo{
								TableName: "users",
								Columns:   []string{"id"},
								OnDelete:  "CASCADE",
							},
						},
						&input.Constraint{
							Name:    "contacts_unique_email",
							Type:    input.UniqueConstraint,
							Columns: []string{"email_address", "user_id"},
						}),
				},
			},
		},
		"multi-column-foreign key": {
			code: map[string]string{
				"user.ts": testhelper.GetCodeWithSchema(`
					import {StringType, EntSchema, ConstraintType} from "{schema}";

					const User = new EntSchema({
						fields: {
							firstName: StringType(),
							lastName: StringType(),
							emailAddress: StringType(),
						},

						constraints: [
							{
								name: "users_unique",
								type: ConstraintType.Unique,
								columns: ["id", "emailAddress"],
							},
						],
					});
					export default User;
				`),
				"contact.ts": testhelper.GetCodeWithSchema(`
					import {EntSchema, UUIDType, StringType, ConstraintType} from "{schema}";

					const Contact = new EntSchema({
						fields: {
							emailAddress: StringType(),
							userID: UUIDType(),
						},

						constraints: [
							{
								name: "contacts_user_fkey",
								type: ConstraintType.ForeignKey,
								columns: ["userID", "emailAddress"],
								fkey: {
									tableName: "users",
									ondelete: "CASCADE",
									columns: ["ID", "emailAddress"],
								}
							},
						],
					});
					export default Contact;
				`),
			},
			expectedMap: map[string]*schema.NodeData{
				"User": {
					Constraints: constraintsWithNodeConstraints("users",
						&input.Constraint{
							Name:    "users_unique",
							Type:    input.UniqueConstraint,
							Columns: []string{"id", "email_address"},
						}),
				},
				"Contact": {
					Constraints: constraintsWithNodeConstraints("contacts",
						&input.Constraint{
							Name:    "contacts_user_fkey",
							Type:    input.ForeignKeyConstraint,
							Columns: []string{"user_id", "email_address"},
							ForeignKey: &input.ForeignKeyInfo{
								TableName: "users",
								Columns:   []string{"id", "email_address"},
								OnDelete:  "CASCADE",
							},
						},
					),
				},
			},
		},
		"check constraint no columns": {
			code: map[string]string{
				"item.ts": testhelper.GetCodeWithSchema(`
					import {FloatType, EntSchema, ConstraintType} from "{schema}";

					const Item = new EntSchema({
						fields: {
							price: FloatType(),
						},

						constraints: [
							{
								name: "item_positive_price",
								type: ConstraintType.Check,
								condition: 'price > 0',
								columns: [],
							},
						],
					});
					export default Item;`),
			},
			expectedMap: map[string]*schema.NodeData{
				"Item": {
					Constraints: constraintsWithNodeConstraints("items", &input.Constraint{
						Name:      "item_positive_price",
						Type:      input.CheckConstraint,
						Columns:   []string{},
						Condition: "price > 0",
					}),
				},
			},
		},
		"check constraint multiple columns": {
			code: map[string]string{
				"item.ts": testhelper.GetCodeWithSchema(`
					import {FloatType, EntSchema, ConstraintType} from "{schema}";

					const Item = new EntSchema({
						fields: {
							price: FloatType(),
							discount_price: FloatType(),
						},

						constraints: [
							{
								name: "item_positive_price",
								type: ConstraintType.Check,
								// TODO condition is required when type == Check
								condition: 'price > 0',
								// TODO need to test this later when we have mixed everything in since we may not
								// want this...
								columns: ['price'],
							},
							{
								name: "item_positive_discount_price",
								type: ConstraintType.Check,
								// TODO condition is required when type == Check
								condition: 'discount_price > 0',
								columns: ['discount_price'],
							},
							{
								name: "item_price_greater_than_discount",
								type: ConstraintType.Check,
								// TODO condition is required when type == Check
								condition: 'price > discount_price',
								columns: ['price', 'discount_price'],
							},
						],
					});
					export default Item;`),
			},
			expectedMap: map[string]*schema.NodeData{
				"Item": {
					Constraints: constraintsWithNodeConstraints("items", &input.Constraint{
						Name:      "item_positive_price",
						Type:      input.CheckConstraint,
						Columns:   []string{"price"},
						Condition: "price > 0",
					},
						&input.Constraint{
							Name:      "item_positive_discount_price",
							Type:      input.CheckConstraint,
							Columns:   []string{"discount_price"},
							Condition: "discount_price > 0",
						},
						&input.Constraint{
							Name:      "item_price_greater_than_discount",
							Type:      input.CheckConstraint,
							Columns:   []string{"price", "discount_price"},
							Condition: "price > discount_price",
						}),
				},
			},
		},
	}

	runTestCases(t, testCases)
}

func TestEnumConstraints(t *testing.T) {
	testCases := map[string]testCase{
		"enum table constraint": {
			code: map[string]string{
				"role.ts": testhelper.GetCodeWithSchema(`
					import {Schema, FieldMap, StringType} from "{schema}";

					export default class Role implements Schema {
						fields: FieldMap = {
							role: StringType({
								primaryKey: true,
							}),
						};

						enumTable = true;

						dbRows = [
							{
								role: 'admin',
							},
							{
								role: 'member',
							},
							{
								role: 'archived_member',
							},
							{
								role: 'super_admin',
							},
							{
								role: 'owner',
							},
						];
					}`),
			},
			expectedMap: map[string]*schema.NodeData{
				"Role": {
					Constraints: []*input.Constraint{
						{
							Name:    "roles_role_pkey",
							Type:    input.PrimaryKeyConstraint,
							Columns: []string{"role"},
						},
					},
				},
			},
		},
		// enum type should not create constraints
		"enum-type constraint": {
			code: map[string]string{
				"request.ts": testhelper.GetCodeWithSchema(
					`import {Schema, EnumType, StringType, EntSchema} from "{schema}";

				const Request = new EntSchema({
					fields: {
						info: StringType(),
						Status: EnumType({values: ["OPEN", "PENDING", "CLOSED"], tsType: "RequestStatus", graphQLType: "RequestStatus", createEnumType: true}),
					},
				});
				export default Request;
				`,
				),
			},
			expectedMap: map[string]*schema.NodeData{
				"Request": {
					Constraints: constraintsWithNodeConstraints("requests"),
				},
			},
		},
		// enum values should not create constraints
		"enum values constraint": {
			code: map[string]string{
				"request.ts": testhelper.GetCodeWithSchema(
					`import {EnumType, StringType, EntSchema} from "{schema}";

				const Request = new EntSchema({
					fields: {
						info: StringType(),
						Status: EnumType({values: ["OPEN", "PENDING", "CLOSED"], tsType: "RequestStatus", graphQLType: "RequestStatus"}),
					},
				});
				export default Request;
				`,
				),
			},
			expectedMap: map[string]*schema.NodeData{
				"Request": {
					Constraints: constraintsWithNodeConstraints("requests"),
				},
			},
		},
		"enum table with fkey constraint": {
			code: map[string]string{
				"request_status.ts": testhelper.GetCodeWithSchema(`
					import {Schema, FieldMap, StringType} from "{schema}";

					export default class RequestStatus implements Schema {
						fields: FieldMap = {
							status: StringType({
								primaryKey: true,
							}),
						};

						enumTable = true;

						dbRows = [
							{
								status: 'open',
							},
							{
								status: 'pending',
							},
							{
								status: 'closed',
							},
						];
					}`),
				"request.ts": testhelper.GetCodeWithSchema(`
					import {Schema, StringType, EnumType, EntSchema} from "{schema}";

					const Request = new EntSchema({
						fields: {
							status: EnumType({
								foreignKey: {schema:"RequestStatus", column:"status"},
							}),
						},
					});
					export default Request;`),
			},
			expectedMap: map[string]*schema.NodeData{
				"RequestStatus": {
					Constraints: []*input.Constraint{
						{
							Name:    "request_statuses_status_pkey",
							Type:    input.PrimaryKeyConstraint,
							Columns: []string{"status"},
						},
					},
				},
				"Request": {
					Constraints: constraintsWithNodeConstraints("requests", &input.Constraint{
						Name:    "requests_status_fkey",
						Type:    input.ForeignKeyConstraint,
						Columns: []string{"status"},
						ForeignKey: &input.ForeignKeyInfo{
							TableName: "request_statuses",
							Columns:   []string{"status"},
							OnDelete:  "CASCADE",
						},
					}),
				},
			},
		},
		"enum with duplicate": {
			code: map[string]string{
				"request_status.ts": testhelper.GetCodeWithSchema(`
					import {Schema, FieldMap, StringType} from "{schema}";

					export default class RequestStatus implements Schema {
						fields: FieldMap = {
							status: StringType({
								primaryKey: true,
							}),
						};

						enumTable = true;

						dbRows = [
							{
								status: 'open',
							},
							{
								status: 'pending',
							},
							{
								status: 'closed',
							},
						];
					}`),
				"request.ts": testhelper.GetCodeWithSchema(`
					import {Schema, StringType, EnumType, EntSchema} from "{schema}";

					const Request = new EntSchema({
						fields:  {
							Status: EnumType({values: ["OPEN", "PENDING", "CLOSED"], tsType: "RequestStatus", graphQLType: "RequestStatus"}),
						},
					});
					export default Request;
					`),
			},
			expectedErr: fmt.Errorf("enum schema with gqlname RequestStatus already exists"),
		},
	}

	runTestCases(t, testCases)
}

func TestInvalidConstraints(t *testing.T) {
	testCases := map[string]testCase{
		"missing fkey field": {
			code: map[string]string{
				"user.ts": testhelper.GetCodeWithSchema(`
					import {StringType, EntSchema} from "{schema}";

					const User = new EntSchema({
						fields: {
							firstName: StringType(),
							lastName: StringType(),
							emailAddress: StringType({
								unique: true,
							}),
						},
					});
					export default User;
				`),
				"contact.ts": testhelper.GetCodeWithSchema(`
					import {EntSchema, UUIDType, StringType, Constraint, ConstraintType} from "{schema}";

					const Contact = new EntSchema({
						fields: {
							emailAddress: StringType(),
							userID: UUIDType(),
						},

						constraints: [
							{
								name: "contacts_user_fkey",
								type: ConstraintType.ForeignKey,
								columns: ["userID", "emailAddress"],
							},
						],
					});
					export default Contact;
				`),
			},
			expectedErr: fmt.Errorf("ForeignKey cannot be nil when type is ForeignKey"),
		},
		"missing condition check constraint": {
			code: map[string]string{
				"item.ts": testhelper.GetCodeWithSchema(`
					import {FloatType, EntSchema, ConstraintType} from "{schema}";

					const Item = new EntSchema({
						fields: {
							price: FloatType(),
						},

						constraints:  [
							{
								name: "item_positive_price",
								type: ConstraintType.Check,
								columns: [],
							},
						],
					});
					export default Item;`),
			},
			expectedErr: fmt.Errorf("Condition is required when constraint type is Check"),
		},
		"fkey on non-unique field": {
			code: map[string]string{
				"user.ts": testhelper.GetCodeWithSchema(
					`import {StringType, EntSchema} from "{schema}";

				const User = new EntSchema({
					fields: {
						firstName: StringType(),
						lastName: StringType(),
					},
				});
				export default User;
			`,
				),
				"contact.ts": testhelper.GetCodeWithSchema(
					`import {StringType, EntSchema, UUIDType} from "{schema}";

				const Contact = new EntSchema({
					fields: {
						firstName: StringType({
							foreignKey: {schema:"User", column:"firstName"},
						}),
						lastName: StringType(),
					},
				});
				export default Contact;
			`,
				),
			},
			expectedErr: fmt.Errorf("foreign key contacts_first_name_fkey with columns which aren't unique in table users"),
		},
		"multi-column-foreign on non unique keys": {
			code: map[string]string{
				"user.ts": testhelper.GetCodeWithSchema(`
					import {StringType, EntSchema, ConstraintType} from "{schema}";

					const User = new EntSchema({
						fields: {
							firstName: StringType(),
							lastName: StringType(),
							emailAddress: StringType(),
						},
					});
					export default User;
				`),
				"contact.ts": testhelper.GetCodeWithSchema(`
					import {EntSchema, UUIDType, StringType, ConstraintType} from "{schema}";

					const Contact = new EntSchema({
						fields: {
							emailAddress: StringType(),
							userID: UUIDType(),
						},

						constraints: [
							{
								name: "contacts_user_fkey",
								type: ConstraintType.ForeignKey,
								columns: ["userID", "emailAddress"],
								fkey: {
									tableName: "users",
									ondelete: "CASCADE",
									columns: ["ID", "emailAddress"],
								}
							},
						],
					});
					export default Contact;
				`),
			},
			expectedErr: fmt.Errorf("foreign key contacts_user_fkey with columns which aren't unique in table users"),
		},
	}
	runTestCases(t, testCases)
}

func TestFullTextIndex(t *testing.T) {
	testCases := map[string]testCase{
		"single-column": {
			code: map[string]string{
				"user.ts": testhelper.GetCodeWithSchema(
					`import {StringType, EntSchema} from "{schema}";

					const User = new EntSchema({
						fields: {
							firstName: StringType(),
						},

						indices: [
							{
								name: "users_first_name_idx",
								columns: ["firstName"],
								fullText: {
									language: 'english',
								},
							},
						],
					});
					export default User;`,
				),
			},
			expectedMap: map[string]*schema.NodeData{
				"User": {
					Constraints: constraintsWithNodeConstraints("users"),
					Indices: []*input.Index{
						{
							Name:    "users_first_name_idx",
							Columns: []string{"firstName"},
							FullText: &input.FullText{
								Language: "english",
							},
						},
					},
				},
			},
		},
		"multi-column": {
			code: map[string]string{
				"user.ts": testhelper.GetCodeWithSchema(
					`import {Field, StringType, Index, EntSchema} from "{schema}";

					const User = new EntSchema({
						fields: {
							firstName: StringType(),
							lastName: StringType(),
						},

						indices: [
							{
								name: "users_name_idx",
								columns: ["firstName", "lastName"],
								fullText: {
									language: 'english',
								},
							},
						],
					});
					export default User;`,
				),
			},
			expectedMap: map[string]*schema.NodeData{
				"User": {
					Constraints: constraintsWithNodeConstraints("users"),
					Indices: []*input.Index{
						{
							Name:    "users_name_idx",
							Columns: []string{"firstName", "lastName"},
							FullText: &input.FullText{
								Language: "english",
							},
						},
					},
				},
			},
		},
		"multi-column-gist": {
			code: map[string]string{
				"user.ts": testhelper.GetCodeWithSchema(
					`import {Field, StringType, EntSchema} from "{schema}";

					const User = new EntSchema({
						fields: {
							firstName: StringType(),
							lastName: StringType(),
						},

						indices: [
							{
								name: "users_name_idx",
								columns: ["firstName", "lastName"],
								fullText: {
									language: 'english',
									indexType: "gist",
								},
							},
						],
					});
					export default User;`,
				),
			},
			expectedMap: map[string]*schema.NodeData{
				"User": {
					Constraints: constraintsWithNodeConstraints("users"),
					Indices: []*input.Index{
						{
							Name:    "users_name_idx",
							Columns: []string{"firstName", "lastName"},
							FullText: &input.FullText{
								Language:  "english",
								IndexType: input.Gist,
							},
						},
					},
				},
			},
		},
		"multi-column-lang-column": {
			code: map[string]string{
				"user.ts": testhelper.GetCodeWithSchema(
					`import {Schema, Field, StringType, Index, EntSchema} from "{schema}";

					const User = new EntSchema({
						fields: {
							firstName: StringType(),
							lastName: StringType(),
						},

						indices: [
							{
								name: "users_name_idx",
								columns: ["firstName", "lastName"],
								fullText: {
									languageColumn: 'language',
									indexType: "gist",
								},
							},
						],
					});
					export default User;`,
				),
			},
			expectedMap: map[string]*schema.NodeData{
				"User": {
					Constraints: constraintsWithNodeConstraints("users"),
					Indices: []*input.Index{
						{
							Name:    "users_name_idx",
							Columns: []string{"firstName", "lastName"},
							FullText: &input.FullText{
								LanguageColumn: "language",
								IndexType:      input.Gist,
							},
						},
					},
				},
			},
		},
		"generated-column": {
			code: map[string]string{
				"user.ts": testhelper.GetCodeWithSchema(
					`import {Schema, StringType, EntSchema} from "{schema}";

					const User = new EntSchema({
						fields: {
							firstName: StringType(),
							lastName: StringType(),
						},

						indices: [
							{
								name: "users_name_idx",
								columns: ["firstName", "lastName"],
								fullText: {
									generatedColumnName: 'name_idx',
									languageColumn: 'language',
									indexType: "gist",
								},
							},
						],
					});
					export default User;`,
				),
			},
			expectedMap: map[string]*schema.NodeData{
				"User": {
					Constraints: constraintsWithNodeConstraints("users"),
					Indices: []*input.Index{
						{
							Name:    "users_name_idx",
							Columns: []string{"firstName", "lastName"},
							FullText: &input.FullText{
								LanguageColumn:      "language",
								IndexType:           input.Gist,
								GeneratedColumnName: "name_idx",
							},
						},
					},
				},
			},
		},
		"lang-andlang-column": {
			code: map[string]string{
				"user.ts": testhelper.GetCodeWithSchema(
					`import {Field, StringType, EntSchema} from "{schema}";

					const User = new EntSchema({
						fields: {
							firstName: StringType(),
						},

						indices: [
							{
								name: "users_first_name_idx",
								columns: ["firstName"],
								fullText: {
									language: 'english',
									languageColumn: 'language',
								},
							},
						],
					});
					export default User;`,
				),
			},
			expectedErr: fmt.Errorf("cannot specify both language and language column for index users_first_name_idx"),
		},
		"neither-lang-and-lang-column": {
			code: map[string]string{
				"user.ts": testhelper.GetCodeWithSchema(
					`import { StringType, EntSchema} from "{schema}";

					const User = new EntSchema({
						fields: {
							firstName: StringType(),
						},

						indices: [
							{
								name: "users_first_name_idx",
								columns: ["firstName"],
								fullText: {
								},
							},
						],
					});
					export default User;`,
				),
			},
			expectedErr: fmt.Errorf("have to specify at least one of language and language column for index users_first_name_idx"),
		},
		"weights-no-generated-column": {
			code: map[string]string{
				"user.ts": testhelper.GetCodeWithSchema(
					`import {StringType,  EntSchema} from "{schema}";

					const User = new EntSchema({
						fields: {
							firstName: StringType(),
						},

						indices: [
							{
								name: "users_first_name_idx",
								columns: ["firstName"],
								fullText: {
									language: 'english',
									weights: {
										A: ['firstName'],
									},
								},
							},
						],
					});
					export default User;`,
				),
			},
			expectedErr: fmt.Errorf("cannot specify weights if no generated column name for index users_first_name_idx"),
		},
		"invalid-weight-passed": {
			code: map[string]string{
				"user.ts": testhelper.GetCodeWithSchema(
					`import {StringType,  EntSchema} from "{schema}";

					const User = new EntSchema({
						fields: {
							firstName: StringType(),
						},

						indices: [
							{
								name: "users_first_name_idx",
								columns: ["firstName"],
								fullText: {
									language: 'english',
									generatedColumnName: 'name_idx',
									weights: {
										A: ['fname'],
									},
								},
							},
						],
					});
					export default User;`,
				),
			},
			expectedErr: fmt.Errorf("invalid field fname passed as weight for index users_first_name_idx"),
		},
		"existing-col-passed-generated-name": {
			code: map[string]string{
				"user.ts": testhelper.GetCodeWithSchema(
					`import {StringType, Index, EntSchema} from "{schema}";

					const User = new EntSchema({
						fields: {
							firstName: StringType(),
							lastName: StringType(),
						},

						indices: [
							{
								name: "users_first_name_idx",
								columns: ["firstName"],
								fullText: {
									language: 'english',
									generatedColumnName: 'lastName',
								},
							},
						],
					});
					export default User;`,
				),
			},
			expectedErr: fmt.Errorf("name lastName already exists for a field and cannot be used as a generated column name for index users_first_name_idx"),
		},
		"duplicated-generated-name": {
			code: map[string]string{
				"user.ts": testhelper.GetCodeWithSchema(
					`import {StringType, EntSchema} from "{schema}";

					const User = new EntSchema({
						fields: {
							firstName: StringType(),
							lastName: StringType(),
						},

						indices: [
							{
								name: "users_first_name_idx",
								columns: ["firstName", "lastName"],
								fullText: {
									language: 'english',
									generatedColumnName: 'name_idx',
								},
							},
							{
								name: "users_first_name_idx",
								columns: ["firstName"],
								fullText: {
									language: 'english',
									generatedColumnName: 'name_idx',
								},
							},
						],
					});
					export default User;`,
				),
			},
			expectedErr: fmt.Errorf("already have generated computed column name_idx"),
		},
		"index-type-specified": {
			code: map[string]string{
				"user.ts": testhelper.GetCodeWithSchema(
					`import {StringType, EntSchema} from "{schema}";

					const User = new EntSchema({
						fields: {
							firstName: StringType(),
						},

						indices: [
							{
								name: "users_first_name_idx",
								columns: ["firstName"],
								indexType: "gin",
								fullText: {
									language: 'english',
								},
							},
						],
					});
					export default User;`,
				),
			},
			expectedErr: fmt.Errorf("if you want to specify the full text index type, specify it in FullText object"),
		},
	}

	runTestCases(t, testCases)
}

func TestIndices(t *testing.T) {
	testCases := map[string]testCase{
		"valid-indices": {
			code: map[string]string{
				"user.ts": testhelper.GetCodeWithSchema(
					`import {StringType, EntSchema} from "{schema}";

					const User = new EntSchema({
						fields: {
							email: StringType(),
						},

						indices: [
							{
								name: "users_unique_email_idx",
								columns: ["email"],
								unique: true
							},
						],
					});
					export default User;`,
				),
			},
			expectedMap: map[string]*schema.NodeData{
				"User": {
					Constraints: constraintsWithNodeConstraints("users"),
					Indices: []*input.Index{
						{
							Name:    "users_unique_email_idx",
							Columns: []string{"email"},
							Unique:  true,
						},
					},
				},
			},
		},
		"list-index-type-specified": {
			code: map[string]string{
				"user.ts": testhelper.GetCodeWithSchema(
					`import {StringListType, EntSchema} from "{schema}";

					const User = new EntSchema({
						fields: {
							emails: StringListType(),
						},

						indices: [
							{
								name: "users_emails_idx",
								columns: ["emails"],
								indexType: 'gin',
							},
						],
					});
					export default User`,
				),
			},
			expectedMap: map[string]*schema.NodeData{
				"User": {
					Constraints: constraintsWithNodeConstraints("users"),
					Indices: []*input.Index{
						{
							Name:      "users_emails_idx",
							Columns:   []string{"emails"},
							IndexType: input.Gin,
						},
					},
				},
			},
		},
		"jsonb-index-type": {
			code: map[string]string{
				"user.ts": testhelper.GetCodeWithSchema(
					`import { StructType, StringType, EntSchema} from "{schema}";

					const User = new EntSchema({
						fields: {
							foo: StructType({
								tsType: 'FooType',
								fields: {
									bar: StringType(),
								},
								name: 'foo',
							}),
						},
												
						indices: [
							{
								name: "users_foo_idx",
								columns: ["foo"],
								indexType: 'gin',
							},
						],
					});
					
					export default User;`,
				),
			},
			expectedMap: map[string]*schema.NodeData{
				"User": {
					Constraints: constraintsWithNodeConstraints("users"),
					Indices: []*input.Index{
						{
							Name:      "users_foo_idx",
							Columns:   []string{"foo"},
							IndexType: input.Gin,
						},
					},
				},
			},
		},
		"gist-index-type-specified": {
			// TODO https://github.com/lolopinto/ent/issues/1029
			skip: true,
			code: map[string]string{
				"user.ts": testhelper.GetCodeWithSchema(
					`import {Schema, Field, StringListType, Index, EntSchema} from "{schema}";

					export default class User = new EntSchema({
						fields: Field[] = [
							StringListType({
								name: 'emails',
							}),
						];

						indices: Index[] = [
							{
								name: "users_emails_idx",
								columns: ["emails"],
								indexType: 'gist',
							},
						];
					}`,
				),
			},
			expectedErr: fmt.Errorf("gist index currently only supported for full text indexes"),
		},
		"invalid-column": {
			code: map[string]string{
				"user.ts": testhelper.GetCodeWithSchema(
					`import {StringType, EntSchema} from "{schema}";

					const User = new EntSchema({
						fields: {
							email: StringType(),
						},

						indices: [
							{
								name: "users_unique_email_idx",
								columns: ["email_address"],
								unique: true
							},
						],
					});
					export default User;`,
				),
			},
			expectedErr: fmt.Errorf("invalid field email_address passed as col for index users_unique_email_idx"),
		},
	}
	runTestCases(t, testCases)
}

type testCase struct {
	code        map[string]string
	only        bool
	skip        bool
	expectedMap map[string]*schema.NodeData
	expectedErr error
}

func runTestCases(t *testing.T, testCases map[string]testCase) {
	hasOnly := false
	for _, tt := range testCases {
		if tt.only {
			hasOnly = true
			break
		}
	}
	for key, tt := range testCases {
		if hasOnly && !tt.only || tt.skip {
			continue
		}
		t.Run(key, func(t *testing.T) {

			testConstraints(t, tt.code, tt.expectedMap, tt.expectedErr)

		})
	}
}

func testConstraints(
	t *testing.T,
	code map[string]string,
	expectedMap map[string]*schema.NodeData,
	expectedErr error,
) {
	s, err := testhelper.ParseSchemaForTestFull(t, code)
	if expectedErr != nil {
		require.Error(t, err)
		assert.Equal(t, err.Error(), expectedErr.Error())
	} else {
		require.Nil(t, err)
		require.NotNil(t, s)
	}

	for k, expNodeData := range expectedMap {
		info := s.Nodes[k]
		var nodeData *schema.NodeData
		if info != nil {
			nodeData = info.NodeData
		} else {
			enumInfo := s.Enums[k]
			require.NotNil(t, enumInfo, "expected %s to exist in schema", k)
			nodeData = enumInfo.NodeData
		}

		expConstraints := expNodeData.Constraints
		constraints := nodeData.Constraints

		require.Len(t, constraints, len(expConstraints))

		for i, expConstraint := range expConstraints {
			constraint := constraints[i]

			assert.Equal(t, expConstraint.Name, constraint.Name)
			assert.Equal(t, expConstraint.Columns, constraint.Columns)
			assert.Equal(t, expConstraint.Type, constraint.Type)
			assert.Equal(t, expConstraint.Condition, constraint.Condition)

			if expConstraint.ForeignKey == nil {
				require.Nil(t, constraint.ForeignKey)
			} else {
				require.NotNil(t, constraint.ForeignKey)

				assert.Equal(t, expConstraint.ForeignKey.TableName, constraint.ForeignKey.TableName)
				assert.Equal(t, expConstraint.ForeignKey.OnDelete, constraint.ForeignKey.OnDelete)
				assert.Equal(t, expConstraint.ForeignKey.Columns, constraint.ForeignKey.Columns)
			}
		}

		expIndices := expNodeData.Indices
		indices := nodeData.Indices
		require.Len(t, indices, len(expIndices))

		for i, expIndex := range expIndices {
			index := indices[i]

			assert.Equal(t, expIndex.Name, index.Name)
			assert.Equal(t, expIndex.Unique, index.Unique)
			assert.Equal(t, expIndex.Columns, index.Columns)

			if expIndex.FullText == nil {
				require.Nil(t, index.FullText)
			} else {
				require.NotNil(t, index.FullText)

				assert.Equal(t, expIndex.FullText.GeneratedColumnName, index.FullText.GeneratedColumnName)
				assert.Equal(t, expIndex.FullText.IndexType, index.FullText.IndexType)
				assert.Equal(t, expIndex.FullText.Language, index.FullText.Language)
				assert.Equal(t, expIndex.FullText.LanguageColumn, index.FullText.LanguageColumn)
				assert.Equal(t, expIndex.FullText.Weights, index.FullText.Weights)
			}
		}
	}
}

func constraintsWithNodeConstraints(tableName string, constraints ...*input.Constraint) []*input.Constraint {
	return append([]*input.Constraint{
		{
			Name:    fmt.Sprintf("%s_id_pkey", tableName),
			Type:    input.PrimaryKeyConstraint,
			Columns: []string{"id"},
		},
	}, constraints...)
}
