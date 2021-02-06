import { GraphQLScalarType } from "graphql";
import { Kind, ValueNode } from "graphql/language";

// Time refers to a Timestamp or Date scalar
export const GraphQLTime = new GraphQLScalarType({
  name: "Time",
  description: "Time scalar type",
  serialize: (outputValue: any) => {
    //console.log("serialize", outputValue, typeof outputValue);
    return new Date(outputValue).toISOString();
  },
  parseValue: (input: any) => {
    //    console.log("parseValue", input);
    return input.getTime();
  },
  parseLiteral: (ast: ValueNode) => {
    //  console.log("literal", ast);
    if (ast.kind === Kind.INT) {
      return new Date(+ast.value);
    }
    return null;
  },
});
