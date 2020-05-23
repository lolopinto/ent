import { GraphQLScalarType } from "graphql";
import { Kind, ValueNode } from "graphql/language";

export const GraphQLTime = new GraphQLScalarType({
  name: "Time",
  description: "Time scalar type",
  serialize: (outputValue: any) => {
    console.log("serialize", outputValue);
    return new Date(outputValue);
  },
  parseValue: (input: any) => {
    console.log("parseValue", input);
    return input.getIme();
  },
  parseLiteral: (ast: ValueNode) => {
    console.log("literal", ast);
    if (ast.kind === Kind.INT) {
      return new Date(+ast.value);
    }
    return null;
  },
});
