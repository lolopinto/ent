import { GraphQLEnumValue } from "graphql";

export function convertToGQLEnum(
  val: string | null,
  tsValues: string[],
  gqlValues: GraphQLEnumValue[],
) {
  for (let i = 0; i < tsValues.length; i++) {
    let tsVal = tsValues[i];
    let gqlValue = gqlValues[i];
    if (val === tsVal) {
      return gqlValue.value;
    }
  }
  return val;
}

export function convertFromGQLEnum(
  val: string,
  tsValues: string[],
  gqlValues: GraphQLEnumValue[],
) {
  for (let i = 0; i < tsValues.length; i++) {
    let tsVal = tsValues[i];
    let gqlValue = gqlValues[i];
    if (val === gqlValue.value) {
      return tsVal;
    }
  }
  return val;
}
