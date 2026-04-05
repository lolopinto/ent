package graphql

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/schema/testhelper"
)

func TestPatternUnionDeterministic(t *testing.T) {
	const nodeCount = 50
	const iterations = 25

	code := map[string]string{
		"patterns/shared_pattern.ts": testhelper.GetCodeWithSchema(
			`import { Pattern, StringType } from "{schema}";

export default class SharedPattern implements Pattern {
  name = "shared_pattern";
  fields = {
    patternField: StringType(),
  };
}`),
	}

	for i := range nodeCount {
		className := fmt.Sprintf("Node%d", i)
		fileName := fmt.Sprintf("%s.ts", className)
		code[fileName] = testhelper.GetCodeWithSchema(fmt.Sprintf(
			`import { EntSchema, StringType } from "{schema}";
import SharedPattern from "./patterns/shared_pattern";

const %s = new EntSchema({
  patterns: [new SharedPattern()],
  fields: {
    name: StringType(),
  },
});
export default %s;`, className, className))
	}

	schema := testhelper.ParseSchemaForTest(t, code)
	processor, err := codegen.NewTestCodegenProcessor("src/schema", schema, &codegen.CodegenConfig{
		DisableGraphQLRoot: true,
	})
	require.NoError(t, err)

	expectedTypes := make(map[string]bool, nodeCount)
	for i := range nodeCount {
		expectedTypes[fmt.Sprintf("Node%dType", i)] = true
	}

	for range iterations {
		result := <-buildGQLSchema(processor)
		require.NoError(t, result.error)

		unionNode := result.schema.nodes["shared_pattern"]
		require.NotNil(t, unionNode)
		require.Len(t, unionNode.ObjData.GQLNodes, 1)

		unionObj := unionNode.ObjData.GQLNodes[0]
		require.Equal(t, "GraphQLUnionType", unionObj.GQLType)
		require.Len(t, unionObj.UnionTypes, nodeCount)

		for _, typ := range unionObj.UnionTypes {
			require.Truef(t, expectedTypes[typ], "unexpected union type %s", typ)
		}
	}
}
