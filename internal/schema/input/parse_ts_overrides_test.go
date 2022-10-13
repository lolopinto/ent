package input_test

import (
	"testing"

	"github.com/lolopinto/ent/internal/schema/input"
)

func TestParseOverrides(t *testing.T) {
	testCases := map[string]testCase{
		"override index": {
			code: map[string]string{
				"user_schema.ts": getCodeWithSchema(`
				import { StringType, EntSchema } from "{schema}";

				const UserSchema = new EntSchema({
					fields: {
						firstName: StringType(),
					},

					fieldOverrides: {
						createdAt: {
							index: true,
						},
					},
				});
				export default UserSchema;`),
				"group_schema.ts": getCodeWithSchema(`
				import { StringType, EntSchema } from "{schema}";

				const GroupSchema = new EntSchema({
					fields: {
						name: StringType(),
					},
				});
				export default GroupSchema;
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
					fields: fieldsWithNodeFields(field{
						name:   "firstName",
						dbType: input.String,
					}),
					fieldOverrides: map[string]*input.FieldOverride{
						"createdAt": {
							Index: true,
						},
					},
				},
				"Group": {
					fields: fieldsWithNodeFields(field{
						name:   "name",
						dbType: input.String,
					}),
				},
			},
		},
		"override unique": {
			code: map[string]string{
				"user_schema.ts": getCodeWithSchema(`
				import { StringType, EntSchema } from "{schema}";

				const UserSchema = new EntSchema({
					fields: {
						firstName: StringType(),
					},

					fieldOverrides: {
						createdAt: {
							unique: true,
						},
					},
				});
				export default UserSchema;`),
				"group_schema.ts": getCodeWithSchema(`
				import { StringType, EntSchema } from "{schema}";

				const GroupSchema = new EntSchema({
					fields: {
						name: StringType(),
					},
				});
				export default GroupSchema;
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
					fields: fieldsWithNodeFields(field{
						name:   "firstName",
						dbType: input.String,
					}),
					fieldOverrides: map[string]*input.FieldOverride{
						"createdAt": {
							Unique: true,
						},
					},
				},
				"Group": {
					fields: fieldsWithNodeFields(field{
						name:   "name",
						dbType: input.String,
					}),
				},
			},
		},
	}

	runTestCases(t, testCases)
}
