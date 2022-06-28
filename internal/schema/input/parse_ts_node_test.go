package input_test

import (
	"testing"

	"github.com/lolopinto/ent/internal/schema/input"
)

func TestHideFromGraphQL(t *testing.T) {
	testCases := map[string]testCase{
		"hidden node": {
			code: map[string]string{
				"auth_code.ts": getCodeWithSchema(`
				import {Schema, Field, StringType} from "{schema}";

				export default class AuthCode implements Schema {
					tableName: string = "auth_codes";

					fields: Field[] = [
				    StringType({ name: "code" }),
					];

					hideFromGraphQL = true;
				}`),
			},
			expectedNodes: map[string]node{
				"AuthCode": {
					tableName: "auth_codes",
					fields: []field{
						{
							name:   "code",
							dbType: input.String,
						},
					},
					hideFromGraphQL: true,
				},
			},
		},
	}

	runTestCases(t, testCases)
}
