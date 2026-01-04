import { GraphQLScalarType, GraphQLError } from "graphql";
import { Kind, ValueNode } from "graphql/language";
import { DateTime } from "luxon";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function normalizeDate(
  input: any,
  throwErr: (msg: string) => GraphQLError,
): string {
  if (typeof input === "string") {
    if (!DATE_REGEX.test(input)) {
      throw throwErr(`Date must be in YYYY-MM-DD format: ${input}`);
    }
    const dt = DateTime.fromISO(input, { zone: "UTC" });
    if (!dt.isValid) {
      throw throwErr(`Invalid Date value ${input}`);
    }
    return dt.toISODate();
  }
  if (input instanceof Date) {
    const result = DateTime.fromJSDate(input).toISODate();
    if (!result) {
      throw throwErr(`Invalid Date value ${input}`);
    }
    return result;
  }
  if (input instanceof DateTime) {
    const result = input.toISODate();
    if (!result) {
      throw throwErr(`Invalid Date value ${input.toISO()}`);
    }
    return result;
  }
  throw throwErr(`Date cannot represent value: ${input}`);
}

export const GraphQLDate = new GraphQLScalarType({
  name: "Date",
  description: "Date scalar type with format YYYY-MM-DD",
  serialize(value: any): string {
    return normalizeDate(value, (msg) => new GraphQLError(msg));
  },
  parseValue(value: any): string {
    return normalizeDate(value, (msg) => new GraphQLError(msg));
  },
  parseLiteral(ast: ValueNode): string {
    if (ast.kind !== Kind.STRING) {
      throw new GraphQLError(`Date cannot represent literal: ${ast.kind}`);
    }
    return normalizeDate(ast.value, (msg) => new GraphQLError(msg));
  },
});
