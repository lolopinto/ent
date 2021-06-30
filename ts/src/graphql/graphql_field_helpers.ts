import {
  GQLCapture,
  CustomField,
  Field,
  CustomObject,
  CustomMutation,
  CustomQuery,
  CustomType,
} from "./graphql";

export function validateOneCustomField(expected: CustomField) {
  let customFields = GQLCapture.getCustomFields();
  // only 1 node
  expect(customFields.size).toBe(1);
  let fields = customFields.get(expected.nodeName);
  expect(fields).toBeDefined();
  validateCustomFieldImpl(expected, fields![0]);
}

function validateCustomFieldsImpl(
  expected: CustomField[],
  actual: CustomField[],
) {
  expect(actual.length).toBe(expected.length);

  for (let i = 0; i < actual.length; i++) {
    let customField = actual[i];
    let expectedCustomField = expected[i];
    validateCustomFieldImpl(expectedCustomField, customField);
  }
}

function validateCustomFieldImpl(
  expectedCustomField: CustomField,
  customField: CustomField,
) {
  expect(customField.nodeName).toBe(expectedCustomField.nodeName);
  expect(customField.functionName).toBe(expectedCustomField.functionName);
  expect(customField.gqlName).toBe(expectedCustomField.gqlName);
  expect(customField.fieldType).toBe(expectedCustomField.fieldType);

  validateFields(customField.results, expectedCustomField.results);

  validateFields(customField.args, expectedCustomField.args);
}

// we keep the simple API for the client and map to what the underlying data structure supports...
export function validateCustomFields(expected: CustomField[]) {
  let map = new Map<string, CustomField[]>();
  expected.forEach((field) => {
    let list = map.get(field.nodeName);

    if (list === undefined) {
      list = [field];
      map.set(field.nodeName, list);
    } else {
      list.push(field);
    }
  });

  let customFields = GQLCapture.getCustomFields();

  expect(map.size).toEqual(customFields.size);

  for (const [key, list] of customFields) {
    let expFields = map.get(key);
    expect(expFields).toBeDefined();

    validateCustomFieldsImpl(expFields!, list);
  }
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
      expect(field.tsType).toBe(expField.tsType);
    }
  }
}

export function validateNoCustomFields() {
  expect(GQLCapture.getCustomFields().size).toBe(0);
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

export function validateNoCustomQueries() {
  expect(GQLCapture.getCustomQueries().length).toBe(0);
}

export function validateNoCustomMutations() {
  expect(GQLCapture.getCustomMutations().length).toBe(0);
}

export function validateNoCustomInputObjects() {
  expect(GQLCapture.getCustomInputObjects().size).toBe(0);
}

export function validateNoCustomObjects() {
  expect(GQLCapture.getCustomObjects().size).toBe(0);
}

export function validateNoCustomTypes() {
  expect(GQLCapture.getCustomTypes().size).toBe(0);
}

export enum CustomObjectTypes {
  Field = 0x1,
  Arg = 0x2,
  Object = 0x4,
  InputObject = 0x8,
  Query = 0x10,
  Mutation = 0x20,
  CustomTypes = 0x40,
}

// TODO what's a good name for this instead
export function validateNoCustom(...exceptions: number[]) {
  let bit = 0;
  exceptions.forEach((exp) => (bit = bit | exp));
  const validate = (typ: CustomObjectTypes, validateFn: () => void) => {
    if (!(bit & typ)) {
      validateFn();
    }
  };
  validate(CustomObjectTypes.Field, validateNoCustomFields);
  validate(CustomObjectTypes.Arg, validateNoCustomArgs);
  validate(CustomObjectTypes.Object, validateNoCustomObjects);
  validate(CustomObjectTypes.Query, validateNoCustomQueries);
  validate(CustomObjectTypes.Mutation, validateNoCustomMutations);
  validate(CustomObjectTypes.InputObject, validateNoCustomInputObjects);
  validate(CustomObjectTypes.CustomTypes, validateNoCustomTypes);
}

export function validateCustomTypes(expected: CustomType[]) {
  const actual = GQLCapture.getCustomTypes();
  expect(actual.size).toBe(expected.length);

  for (let i = 0; i < expected.length; i++) {
    let expectedObj = expected[i];
    let obj = actual.get(expectedObj.type);
    expect(obj).not.toBe(undefined);

    expect(obj!.type).toBe(expectedObj.type);
    expect(obj!.importPath).toBe(expectedObj.importPath);
    expect(obj!.tsType).toBe(expectedObj.tsType);
    expect(obj!.tsImportPath).toBe(expectedObj.tsImportPath);
  }
}
