import { transformUnionInput } from "./union";
import { encodeGQLID, mustDecodeIDFromGQLID } from "../node_resolver";

const id = "00000000-0000-4000-8000-000000000001";
const encoded = encodeGQLID({ id, nodeType: "holiday" });

test("converts only the selected union variant without mutating GraphQL input", () => {
  const encodedMember = jest.fn((value) => ({ ...value, id: mustDecodeIDFromGQLID(value.id) }));
  const rawMember = jest.fn((value) => value);
  const members = { encoded: encodedMember, raw: rawMember };
  const input = Object.freeze({ encoded: Object.freeze({ id: encoded }) });
  expect(transformUnionInput(input, members)).toEqual({ id });
  expect(rawMember).not.toHaveBeenCalled();
  expect(input.encoded.id).toBe(encoded);
  expect(transformUnionInput({ raw: { id } }, members)).toEqual({ id });
  expect(encodedMember).toHaveBeenCalledTimes(1);
});

test("preserves omitted and null unions and selected nullable members", () => {
  const member = jest.fn((value) => value);
  expect(transformUnionInput(undefined, { member })).toBeUndefined();
  expect(transformUnionInput(null, { member })).toBeNull();
  expect(member).not.toHaveBeenCalled();
  expect(transformUnionInput({ member: null }, { member })).toBeNull();
});

test("requires exactly one declared variant before invoking a converter", () => {
  const member = jest.fn();
  const members = { member };
  for (const input of [{}, { member: null, other: {} }]) {
    expect(() => transformUnionInput(input, members)).toThrow("pass one key of union");
  }
  expect(() => transformUnionInput({ other: {} }, members)).toThrow("unknown union member");
  expect(() => transformUnionInput({ toString: {} }, members)).toThrow("unknown union member");
  expect(member).not.toHaveBeenCalled();
});

test("handles null-prototype GraphQL literals and recursively selected variants", () => {
  const literal = Object.assign(Object.create(null), {
    outer: { choice: Object.assign(Object.create(null), { inner: { id: encoded } }) },
  });
  expect(transformUnionInput(literal, {
    outer: (value) => ({ ...value, choice: transformUnionInput(value.choice, {
      inner: (child) => ({ id: mustDecodeIDFromGQLID(child.id) }),
    }) }),
  })).toEqual({ choice: { id } });
});
