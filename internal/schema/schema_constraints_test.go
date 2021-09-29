package schema_test

import (
	"fmt"
	"testing"

	"github.com/lolopinto/ent/internal/schema"
	"github.com/lolopinto/ent/internal/schema/base"
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
				`import {Field, StringType, BaseEntSchema} from "{schema}";

				export default class User extends BaseEntSchema {
					fields: Field[] = [
						StringType({
							name: 'firstName',
						}),
						StringType({
							name: 'lastName',
						}),
					];
				}
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
				`import {Field, StringType, BaseEntSchema} from "{schema}";

				export default class User extends BaseEntSchema {
					fields: Field[] = [
						StringType({
							name: 'firstName',
						}),
						StringType({
							name: 'lastName',
						}),
					];
				}
			`,
			),
			"contact.ts": testhelper.GetCodeWithSchema(
				`import {Field, StringType, BaseEntSchema, UUIDType} from "{schema}";

				export default class Contact extends BaseEntSchema {
					fields: Field[] = [
						StringType({
							name: 'firstName',
						}),
						StringType({
							name: 'lastName',
						}),
						UUIDType({
							name: "ownerID",
							foreignKey: {schema:"User", column:"ID"},
						}),
					];
				}
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
				`import {Field, StringType, BaseEntSchema} from "{schema}";

				export default class User extends BaseEntSchema {
					fields: Field[] = [
						StringType({
							name: 'firstName',
						}),
						StringType({
							name: 'lastName',
						}),
						StringType({
							name: "emailAddress",
							unique: true,
						})
					];
				}
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
					import {Schema, Field, UUIDType, Constraint, ConstraintType} from "{schema}";

					export default class UserPhoto implements Schema {
						fields: Field[] = [
							UUIDType({
								name: 'UserID',
							}),
							UUIDType({
								name: 'PhotoID',
							}),
						];

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
					import {Field, StringType, BaseEntSchema} from "{schema}";

					export default class User extends BaseEntSchema {
						fields: Field[] = [
							StringType({
								name: 'firstName',
							}),
							StringType({
								name: 'lastName',
							}),
						];
					}
				`),
				"contact.ts": testhelper.GetCodeWithSchema(`
					import {BaseEntSchema, Field, UUIDType, StringType, Constraint, ConstraintType} from "{schema}";

					export default class Contact extends BaseEntSchema {
						fields: Field[] = [
							StringType({
								name: "emailAddress",
							}),
							UUIDType({
								name: "userID",
								foreignKey: {schema:"User", column:"ID"},
							}),
						];

						constraints: Constraint[] = [
							{
								name: "contacts_unique_email",
								type: ConstraintType.Unique,
								columns: ["emailAddress", "userID"],
							},
						];
					}
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
					import {Field, StringType, BaseEntSchema, Constraint, ConstraintType} from "{schema}";

					export default class User extends BaseEntSchema {
						fields: Field[] = [
							StringType({
								name: 'firstName',
							}),
							StringType({
								name: 'lastName',
							}),
							StringType({
								name: 'emailAddress',
							}),
						];

						constraints: Constraint[] = [
							{
								name: "users_unique",
								type: ConstraintType.Unique,
								columns: ["id", "emailAddress"],
							},
						];
					}
				`),
				"contact.ts": testhelper.GetCodeWithSchema(`
					import {BaseEntSchema, Field, UUIDType, StringType, Constraint, ConstraintType} from "{schema}";

					export default class Contact extends BaseEntSchema {
						fields: Field[] = [
							StringType({
								name: "emailAddress",
							}),
							UUIDType({
								name: "userID",
							}),
						];

						constraints: Constraint[] = [
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
						];
					}
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
					import {Field, FloatType, BaseEntSchema, Constraint, ConstraintType} from "{schema}";

					export default class Item extends BaseEntSchema {
						fields: Field[] = [
							FloatType({
								name: 'price',
							}),
						];

						constraints: Constraint[] = [
							{
								name: "item_positive_price",
								type: ConstraintType.Check,
								condition: 'price > 0',
								columns: [],
							},
						];
					}`),
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
					import {Field, FloatType, BaseEntSchema, Constraint, ConstraintType} from "{schema}";

					export default class Item extends BaseEntSchema {
						fields: Field[] = [
							FloatType({
								name: 'price',
							}),
							FloatType({
								name: 'discount_price',
							}),
						];

						constraints: Constraint[] = [
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
						];
					}`),
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
					import {Schema, Field, StringType} from "{schema}";

					export default class Role implements Schema {
						fields: Field[] = [
							StringType({
								name: 'role',
								primaryKey: true,
							}),
						];

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
					`import {Schema, Field, EnumType, StringType, BaseEntSchema} from "{schema}";

				export default class Request extends BaseEntSchema {
					fields: Field[] = [
						StringType({name: "info"}),
						EnumType({name: "Status", values: ["OPEN", "PENDING", "CLOSED"], tsType: "RequestStatus", graphQLType: "RequestStatus", createEnumType: true}),
					]
				}
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
					`import {Schema, Field, EnumType, StringType, BaseEntSchema} from "{schema}";

				export default class Request extends BaseEntSchema {
					fields: Field[] = [
						StringType({name: "info"}),
						EnumType({name: "Status", values: ["OPEN", "PENDING", "CLOSED"], tsType: "RequestStatus", graphQLType: "RequestStatus"}),
					]
				}
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
					import {Schema, Field, StringType} from "{schema}";

					export default class RequestStatus implements Schema {
						fields: Field[] = [
							StringType({
								name: 'status',
								primaryKey: true,
							}),
						];

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
					import {Schema, Field, StringType, EnumType, BaseEntSchema} from "{schema}";

					export default class Request extends BaseEntSchema {
						fields: Field[] = [
							EnumType({
								name: 'status',
								foreignKey: {schema:"RequestStatus", column:"status"},
							}),
						];
					}`),
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
			only: true,
			code: map[string]string{
				"request_status.ts": testhelper.GetCodeWithSchema(`
					import {Schema, Field, StringType} from "{schema}";

					export default class RequestStatus implements Schema {
						fields: Field[] = [
							StringType({
								name: 'status',
								primaryKey: true,
							}),
						];

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
					import {Schema, Field, StringType, EnumType, BaseEntSchema} from "{schema}";

					export default class Request extends BaseEntSchema {
						fields: Field[] = [
							EnumType({name: "Status", values: ["OPEN", "PENDING", "CLOSED"], tsType: "RequestStatus", graphQLType: "RequestStatus"}),
						];
					}`),
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
					import {Field, StringType, BaseEntSchema} from "{schema}";

					export default class User extends BaseEntSchema {
						fields: Field[] = [
							StringType({
								name: 'firstName',
							}),
							StringType({
								name: 'lastName',
							}),
							StringType({
								name: 'emailAddress',
								unique: true,
							}),
						];
					}
				`),
				"contact.ts": testhelper.GetCodeWithSchema(`
					import {BaseEntSchema, Field, UUIDType, StringType, Constraint, ConstraintType} from "{schema}";

					export default class Contact extends BaseEntSchema {
						fields: Field[] = [
							StringType({
								name: "emailAddress",
							}),
							UUIDType({
								name: "userID",
							}),
						];

						constraints: Constraint[] = [
							{
								name: "contacts_user_fkey",
								type: ConstraintType.ForeignKey,
								columns: ["userID", "emailAddress"],
							},
						];
					}
				`),
			},
			expectedErr: fmt.Errorf("ForeignKey cannot be nil when type is ForeignKey"),
		},
		"missing condition check constraint": {
			code: map[string]string{
				"item.ts": testhelper.GetCodeWithSchema(`
					import {Field, FloatType, BaseEntSchema, Constraint, ConstraintType} from "{schema}";

					export default class Item extends BaseEntSchema {
						fields: Field[] = [
							FloatType({
								name: 'price',
							}),
						];

						constraints: Constraint[] = [
							{
								name: "item_positive_price",
								type: ConstraintType.Check,
								columns: [],
							},
						];
					}`),
			},
			expectedErr: fmt.Errorf("Condition is required when constraint type is Check"),
		},
		"fkey on non-unique field": {
			code: map[string]string{
				"user.ts": testhelper.GetCodeWithSchema(
					`import {Field, StringType, BaseEntSchema} from "{schema}";

				export default class User extends BaseEntSchema {
					fields: Field[] = [
						StringType({
							name: 'firstName',
						}),
						StringType({
							name: 'lastName',
						}),
					];
				}
			`,
				),
				"contact.ts": testhelper.GetCodeWithSchema(
					`import {Field, StringType, BaseEntSchema, UUIDType} from "{schema}";

				export default class Contact extends BaseEntSchema {
					fields: Field[] = [
						StringType({
							name: 'firstName',
							foreignKey: {schema:"User", column:"firstName"},
						}),
						StringType({
							name: 'lastName',
						}),
					];
				}
			`,
				),
			},
			expectedErr: fmt.Errorf("foreign key contacts_first_name_fkey with columns which aren't unique in table users"),
		},
		"multi-column-foreign on non unique keys": {
			code: map[string]string{
				"user.ts": testhelper.GetCodeWithSchema(`
					import {Field, StringType, BaseEntSchema, Constraint, ConstraintType} from "{schema}";

					export default class User extends BaseEntSchema {
						fields: Field[] = [
							StringType({
								name: 'firstName',
							}),
							StringType({
								name: 'lastName',
							}),
							StringType({
								name: 'emailAddress',
							}),
						];
					}
				`),
				"contact.ts": testhelper.GetCodeWithSchema(`
					import {BaseEntSchema, Field, UUIDType, StringType, Constraint, ConstraintType} from "{schema}";

					export default class Contact extends BaseEntSchema {
						fields: Field[] = [
							StringType({
								name: "emailAddress",
							}),
							UUIDType({
								name: "userID",
							}),
						];

						constraints: Constraint[] = [
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
						];
					}
				`),
			},
			expectedErr: fmt.Errorf("foreign key contacts_user_fkey with columns which aren't unique in table users"),
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
	s, err := testhelper.ParseSchemaForTestFull(
		t,
		code,
		base.TypeScript,
	)
	if expectedErr != nil {
		require.Error(t, err)
		assert.Equal(t, err.Error(), expectedErr.Error())
	} else {
		require.Nil(t, err)
		require.NotNil(t, s)
	}

	for k, expNodeData := range expectedMap {
		info := s.Nodes[k+"Config"]
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
