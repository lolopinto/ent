import {
  GQLCapture,
  CustomField,
  Field,
  CustomObject,
  CustomMutation,
  CustomQuery,
} from "./graphql";

export function validateOneCustomField(expected: CustomField) {
  validateCustomFields([expected]);
}

function validateCustomFieldsImpl(
  expected: CustomField[],
  actual: CustomField[],
) {
  expect(actual.length).toBe(expected.length);

  for (let i = 0; i < actual.length; i++) {
    let customField = actual[i];
    let expectedCustomField = expected[i];
    expect(customField.nodeName).toBe(expectedCustomField.nodeName);
    expect(customField.functionName).toBe(expectedCustomField.functionName);
    expect(customField.gqlName).toBe(expectedCustomField.gqlName);
    expect(customField.fieldType).toBe(expectedCustomField.fieldType);

    validateFields(customField.results, expectedCustomField.results);

    validateFields(customField.args, expectedCustomField.args);
  }
}

export function validateCustomFields(expected: CustomField[]) {
  validateCustomFieldsImpl(expected, GQLCapture.getCustomFields());
}

export function validateCustomMutations(expected: CustomMutation[]) {
  validateCustomFieldsImpl(expected, GQLCapture.getCustomMutations());
}

export function validateCustomQueries(expected: CustomQuery[]) {
  validateCustomFieldsImpl(expected, GQLCapture.getCustomQueries());
}

export function validateFields(actual: Field[], expected: Field[]) {
  expect(actual.length).toBe(expected.length);

  for (let j = 0; j < actual.length; j++) {
    let field = actual[j];
    let expField = expected[j];

    expect(field.type).toBe(expField.type);
    expect(field.name).toBe(expField.name);
    expect(field.needsResolving, field.name).toBe(expField.needsResolving);
    expect(field.nullable, field.name).toBe(expField.nullable);
    expect(field.isContextArg, field.name).toBe(expField.isContextArg);

    // TODO set this for everyone and then don't need this...
    if (expField.tsType) {
      expect(field.tsType, expField.tsType);
    }
  }
}

export function validateNoCustomFields() {
  expect(GQLCapture.getCustomFields().length).toBe(0);
}

function validateCustom(
  expected: CustomObject[],
  actual: Map<string, CustomObject>,
) {
  expect(actual.size).toBe(expected.length);

  for (let i = 0; i < expected.length; i++) {
    let expectedObj = expected[i];
    let obj = actual.get(expectedObj.className);
    expect(obj).not.toBe(undefined);
    //    let arg = args[i];

    expect(obj!.className).toBe(expectedObj.className);
    expect(obj!.nodeName).toBe(expectedObj.nodeName);
  }
}

export function validateCustomArgs(expected: CustomObject[]) {
  validateCustom(expected, GQLCapture.getCustomArgs());
}

export function validateCustomInputObjects(expected: CustomObject[]) {
  validateCustom(expected, GQLCapture.getCustomInputObjects());
}

export function validateCustomObjects(expected: CustomObject[]) {
  validateCustom(expected, GQLCapture.getCustomObjects());
}

export function validateNoCustomArgs() {
  expect(GQLCapture.getCustomArgs().size).toBe(0);
}

export function validateNoCustom() {
  validateNoCustomFields();
  validateNoCustomArgs();
}
