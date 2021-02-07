import { GraphQLScalarType, GraphQLError } from "graphql";
import { Kind, ValueNode } from "graphql/language";
import { DateTime } from "luxon";

// Time refers to a Timestamp or Date scalar

function parseValue(input: any): Date {
  let dt: DateTime;
  if (typeof input === "number") {
    dt = DateTime.fromMillis(input);
  } else if (typeof input === "string") {
    dt = DateTime.fromISO(input);
    if (!dt.isValid) {
      let ms = Date.parse(input);
      if (ms === NaN) {
        throw new GraphQLError(`invalid input for type Time ${input}`);
      }
      dt = DateTime.fromMillis(ms);
    }
  } else if (input instanceof Date) {
    return input;
  } else if (input instanceof DateTime) {
    dt = input;
  } else {
    throw new GraphQLError(`invalid input for type Time ${input}`);
  }
  if (!dt.isValid) {
    throw new GraphQLError(`invalid input for type Time ${input}`);
  }
  return dt.toJSDate();
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
