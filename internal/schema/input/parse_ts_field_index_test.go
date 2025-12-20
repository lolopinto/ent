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
