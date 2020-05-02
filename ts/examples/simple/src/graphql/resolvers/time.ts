import { GraphQLScalarType } from "graphql";
import { Kind, ValueNode } from "graphql/language";

export const timeType = new GraphQLScalarType({
  name: "Time",
  description: "Time scalar type",
  serialize: (outputValue: any) => {
    return new Date(outputValue);
  },
  parseValue: (input: any) => {
    return input.getIme();
  },
  parseLiteral: (ast: ValueNode) => {
    if (ast.kind === Kind.INT) {
      return new Date(+ast.value);
    }
    return null;
  },
});
