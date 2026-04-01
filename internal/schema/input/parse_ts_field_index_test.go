package input_test

import (
	"testing"

	"github.com/lolopinto/ent/internal/schema/input"
)

func TestFieldIndexConcurrently(t *testing.T) {
	testCases := map[string]testCase{
		"field index concurrently": {
			code: map[string]string{
				"user.ts": getCodeWithSchema(`
					import {EntSchema, StringType} from "{schema}";

					const UserSchema = new EntSchema({
						fields: {
							email: StringType({
								index: true,
								indexConcurrently: true,
							}),
						},
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
							name:              "email",
							dbType:            input.String,
							index:             true,
							indexConcurrently: true,
						},
					),
				},
			},
		},
	}

	runTestCases(t, testCases)
}

func TestFieldIndexWhere(t *testing.T) {
	testCases := map[string]testCase{
		"field index where": {
			code: map[string]string{
				"user.ts": getCodeWithSchema(`
					import {EntSchema, IntegerType} from "{schema}";

					const UserSchema = new EntSchema({
						fields: {
							place: IntegerType({
								index: true,
								indexWhere: "place = 1",
							}),
						},
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
							name:       "place",
							dbType:     input.Int,
							index:      true,
							indexWhere: "place = 1",
						},
					),
				},
			},
		},
	}

	runTestCases(t, testCases)
}

func TestIndexOperatorClassesAndStorageParams(t *testing.T) {
	testCases := map[string]testCase{
		"index operator classes and storage params": {
			code: map[string]string{
				"user.ts": getCodeWithSchema(`
					import {EntSchema, StringType} from "{schema}";

					const UserSchema = new EntSchema({
						fields: {
							email: StringType(),
						},
						indices: [
							{
								name: "users_email_pattern_idx",
								columns: ["email"],
								indexType: "btree",
								ops: {
									email: "text_pattern_ops",
								},
								indexParams: {
									fillfactor: 70,
								},
							},
						],
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
							name:   "email",
							dbType: input.String,
						},
					),
					indices: []index{
						{
							name:      "users_email_pattern_idx",
							columns:   []string{"email"},
							indexType: input.Btree,
							ops: map[string]string{
								"email": "text_pattern_ops",
							},
							indexParams: map[string]interface{}{
								"fillfactor": float64(70),
							},
						},
					},
				},
			},
		},
	}

	runTestCases(t, testCases)
}
