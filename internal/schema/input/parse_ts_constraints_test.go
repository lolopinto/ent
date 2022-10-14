package input_test

import (
	"testing"

	"github.com/lolopinto/ent/internal/schema/input"
)

func TestConstraints(t *testing.T) {
	testCases := map[string]testCase{
		"multi-column-primary key": {
			code: map[string]string{
				"user_photo.ts": getCodeWithSchema(`
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
			expectedNodes: map[string]node{
				"UserPhoto": {
					fields: []field{
						{
							name:   "UserID",
							dbType: input.UUID,
						},
						{
							name:   "PhotoID",
							dbType: input.UUID,
						},
					},
					constraints: []constraint{
						{
							name:    "user_photos_pkey",
							typ:     input.PrimaryKeyConstraint,
							columns: []string{"UserID", "PhotoID"},
						},
					},
				},
			},
		},
		"single-column-primary key": {
			code: map[string]string{
				"username.ts": getCodeWithSchema(`
					import {Schema, FieldMap, StringType, Constraint, ConstraintType} from "{schema}";

					export default class Username implements Schema {
						fields: FieldMap = {
							username: StringType(),
						};

						constraints: Constraint[] = [
							{
								name: "username_pkey",
								type: ConstraintType.PrimaryKey,
								columns: ["username"],
							},
						];
					}
				`),
			},
			expectedNodes: map[string]node{
				"Username": {
					fields: []field{
						{
							name:   "username",
							dbType: input.String,
						},
					},
					constraints: []constraint{
						{
							name:    "username_pkey",
							typ:     input.PrimaryKeyConstraint,
							columns: []string{"username"},
						},
					},
				},
			},
		},
		"multi-column unique key": {
			code: map[string]string{
				"user.ts": getCodeWithSchema(`
					import {StringType, EntSchema} from "{schema}";

					const User = new EntSchema({
						fields: {
							firstName: StringType(),
							lastName: StringType(),
						},
					});
					export default User;
					`),
				"contact.ts": getCodeWithSchema(`
					import {EntSchema, UUIDType, StringType, Constraint, ConstraintType} from "{schema}";

					const Contact = new EntSchema({
						fields: {
							firstName: StringType(),
							lastName: StringType(),
							// this *should* be EmailType but not worth it
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
						field{
							name:   "lastName",
							dbType: input.String,
						},
					),
				},
				"Contact": {
					fields: fieldsWithNodeFields(
						field{
							name:   "firstName",
							dbType: input.String,
						},
						field{
							name:   "lastName",
							dbType: input.String,
						},
						field{
							name:   "emailAddress",
							dbType: input.String,
						},
						field{
							name:       "userID",
							dbType:     input.UUID,
							foreignKey: &input.ForeignKey{Schema: "User", Column: "ID"},
						}),
					constraints: []constraint{
						{
							name:    "contacts_unique_email",
							typ:     input.UniqueConstraint,
							columns: []string{"emailAddress", "userID"},
						},
					},
				},
			},
		},
		"single column foreign key": {
			code: map[string]string{
				"user.ts": getCodeWithSchema(`
					import {StringType, EntSchema} from "{schema}";

					const UserSchema = new EntSchema({
						fields: {
							firstName: StringType(),
							lastName: StringType(),
						},
					});
					export default UserSchema;					
					`),
				"contact.ts": getCodeWithSchema(`
					import {EntSchema, UUIDType, StringType, ConstraintType} from "{schema}";

					const ContactSchema = new EntSchema({
						fields: {
							userID: UUIDType(),
						},

						// using constraint instead of foreignKey field...
						constraints: [
							{
								name: "contacts_user_fkey",
								type: ConstraintType.ForeignKey,
								columns: ["userID"],
								fkey: {
									tableName: "User",
									columns: ["ID"],
								}
							},
						],
					});
					export default ContactSchema;
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
							name:   "firstName",
							dbType: input.String,
						},
						field{
							name:   "lastName",
							dbType: input.String,
						},
					),
				},
				"Contact": {
					fields: fieldsWithNodeFields(
						field{
							name:   "userID",
							dbType: input.UUID,
						}),
					constraints: []constraint{
						{
							name:    "contacts_user_fkey",
							typ:     input.ForeignKeyConstraint,
							columns: []string{"userID"},
							fkey: &fkeyInfo{
								tableName: "User",
								columns:   []string{"ID"},
							},
						},
					},
				},
			},
		},
		"multi column foreign key": {
			code: map[string]string{
				"user.ts": getCodeWithSchema(`
					import {StringType, EntSchema} from "{schema}";

					const UserSchema = new EntSchema({
						fields: {
							firstName: StringType(),
							lastName: StringType(),
							emailAddress: StringType({
								unique: true,
							}),
						},
					});
					export default UserSchema;
					`),
				"contact.ts": getCodeWithSchema(`
					import {EntSchema, UUIDType, StringType, Constraint, ConstraintType} from "{schema}";

					const ContactSchema = new EntSchema({
						fields: {
							userID: UUIDType(),
							emailAddress: StringType(),
						},

						constraints: [
							{
								name: "contacts_user_fkey",
								type: ConstraintType.ForeignKey,
								columns: ["userID", "emailAddress"],
								fkey: {
									tableName: "User",
									ondelete: "CASCADE",
									columns: ["ID", "emailAddress"],
								}
							},
						],
					});
					export default ContactSchema;
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
							name:   "firstName",
							dbType: input.String,
						},
						field{
							name:   "lastName",
							dbType: input.String,
						},
						field{
							name:   "emailAddress",
							dbType: input.String,
							unique: true,
						},
					),
				},
				"Contact": {
					fields: fieldsWithNodeFields(
						field{
							name:   "userID",
							dbType: input.UUID,
						},
						field{
							name:   "emailAddress",
							dbType: input.String,
						}),
					constraints: []constraint{
						{
							name:    "contacts_user_fkey",
							typ:     input.ForeignKeyConstraint,
							columns: []string{"userID", "emailAddress"},
							fkey: &fkeyInfo{
								tableName: "User",
								ondelete:  input.Cascade,
								columns:   []string{"ID", "emailAddress"},
							},
						},
					},
				},
			},
		},
		"check constraint no columns": {
			code: map[string]string{
				"item.ts": getCodeWithSchema(`
					import {FloatType, EntSchema, ConstraintType} from "{schema}";

					const ItemSchema = new EntSchema({
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
					export default ItemSchema;`),
			},
			expectedPatterns: map[string]pattern{
				"node": {
					name:   "node",
					fields: nodeFields(),
				},
			},
			expectedNodes: map[string]node{
				"Item": {
					fields: fieldsWithNodeFields(
						field{
							name:   "price",
							dbType: input.Float,
						},
					),
					constraints: []constraint{
						{
							name:      "item_positive_price",
							typ:       input.CheckConstraint,
							condition: "price > 0",
							columns:   []string{},
						},
					},
				},
			},
		},
		"check constraint multiple columns": {
			code: map[string]string{
				"item.ts": getCodeWithSchema(`
					import {FloatType, EntSchema, ConstraintType} from "{schema}";

					const ItemSchema = new EntSchema({
						fields: {
							price: FloatType(),
							discount_price: FloatType(),
						},

						constraints: [
							{
								name: "item_positive_price",
								type: ConstraintType.Check,
								condition: 'price > 0',
								// TODO need to test this later when we have mixed everything in since we may not
								// want this...
								columns: ['price'],
							},
							{
								name: "item_positive_discount_price",
								type: ConstraintType.Check,
								condition: 'discount_price > 0',
								columns: ['discount_price'],
							},
							{
								name: "item_price_greater_than_discount",
								type: ConstraintType.Check,
								condition: 'price > discount_price',
								columns: ['price', 'discount_price'],
							},
						],
					});
					export default ItemSchema;`),
			},
			expectedPatterns: map[string]pattern{
				"node": {
					name:   "node",
					fields: nodeFields(),
				},
			},
			expectedNodes: map[string]node{
				"Item": {
					fields: fieldsWithNodeFields(
						field{
							name:   "price",
							dbType: input.Float,
						},
						field{
							name:   "discount_price",
							dbType: input.Float,
						},
					),
					constraints: []constraint{
						{
							name:      "item_positive_price",
							typ:       input.CheckConstraint,
							condition: "price > 0",
							columns:   []string{"price"},
						},
						{
							name:      "item_positive_discount_price",
							typ:       input.CheckConstraint,
							condition: "discount_price > 0",
							columns:   []string{"discount_price"},
						},
						{
							name:      "item_price_greater_than_discount",
							typ:       input.CheckConstraint,
							condition: "price > discount_price",
							columns:   []string{"price", "discount_price"},
						},
					},
				},
			},
		},
	}

	runTestCases(t, testCases)
}

func TestIndices(t *testing.T) {
	testCases := map[string]testCase{
		"multi-column index": {
			code: map[string]string{
				"contact.ts": getCodeWithSchema(`
					import {EntSchema, StringType} from "{schema}";

					const ContactSchema = new EntSchema({
						fields: {
							firstName: StringType(),
							lastName: StringType(),
							// this *should* be EmailType but not worth it
							emailAddress: StringType(),
						},

						indices: [
							{
								name: "contacts_name_index",
								columns: ["firstName", "lastName"],
							},
						],
					});
					export default ContactSchema;
				`),
			},
			expectedPatterns: map[string]pattern{
				"node": {
					name:   "node",
					fields: nodeFields(),
				},
			},
			expectedNodes: map[string]node{
				"Contact": {
					fields: fieldsWithNodeFields(
						field{
							name:   "firstName",
							dbType: input.String,
						},
						field{
							name:   "lastName",
							dbType: input.String,
						},
						field{
							name:   "emailAddress",
							dbType: input.String,
						}),
					indices: []index{
						{
							name:    "contacts_name_index",
							columns: []string{"firstName", "lastName"},
						},
					},
				},
			},
		},
		// same example from above can also be represented as unique index
		"multi-column unique index": {
			code: map[string]string{
				"user_schema.ts": getCodeWithSchema(`
					import {StringType, EntSchema} from "{schema}";

					const UserSchema = new EntSchema({
						fields: {
							firstName: StringType(),
							lastName: StringType(),
						},
					});
					export default UserSchema;
					`),
				"contact_schema.ts": getCodeWithSchema(`
					import {EntSchema, UUIDType, StringType} from "{schema}";

					const ContactSchema = new EntSchema({
						fields: {
							firstName: StringType(),
							lastName: StringType(),
							// this *should* be EmailType but not worth it
							emailAddress: StringType(),
							userID: UUIDType({
								foreignKey: {schema:"User", column:"ID"},
							}),
						},

						indices: [
							{
								name: "contacts_unique_email",
								columns: ["emailAddress", "userID"],
								unique: true,
							},
						],
					});
					export default ContactSchema;
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
							name:   "firstName",
							dbType: input.String,
						},
						field{
							name:   "lastName",
							dbType: input.String,
						},
					),
				},
				"Contact": {
					fields: fieldsWithNodeFields(
						field{
							name:   "firstName",
							dbType: input.String,
						},
						field{
							name:   "lastName",
							dbType: input.String,
						},
						field{
							name:   "emailAddress",
							dbType: input.String,
						},
						field{
							name:       "userID",
							dbType:     input.UUID,
							foreignKey: &input.ForeignKey{Schema: "User", Column: "ID"},
						}),
					indices: []index{
						{
							name:    "contacts_unique_email",
							columns: []string{"emailAddress", "userID"},
							unique:  true,
						},
					},
				},
			},
		},
	}

	runTestCases(t, testCases)
}
