import { GraphQLScalarType, GraphQLError } from "graphql";
import { Kind, ValueNode } from "graphql/language";
import { DateTime } from "luxon";
import { parseDate } from "../../core/date";

// Time refers to a Timestamp or Date scalar

function parseValue(input: any): Date {
  return parseDate(input, (msg: string) => {
    return new GraphQLError(msg);
  }).toJSDate();
}

// Date or Timestamp
// Need feedback. should this be renamed to Timestamp?
// This is called Time but only supports Date and Timestamp values
// and `Time` isn't supported. that's a string
export const GraphQLTime = new GraphQLScalarType({
  name: "Time",
  description: "Time scalar type",
  serialize: (outputValue: any) => {
    if (outputValue instanceof Date) {
      return outputValue.toISOString();
    } else if (outputValue instanceof DateTime) {
      return outputValue.toUTC().toISO();
    }
    return parseValue(outputValue).toISOString();
  },
  parseValue: parseValue,
  parseLiteral: (ast: ValueNode) => {
    //    console.log("literal", ast);
    if (ast.kind === Kind.INT) {
      return new Date(+ast.value);
    }
    // TODO?
    throw new GraphQLError(`Time cannot represent literal value ${ast}`);
  },
});
