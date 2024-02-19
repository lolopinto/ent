import each from "jest-each";
import { toFieldName, toDBColumnOrTable } from "./names";

each([
  ["ID", "id"],
  ["id", "id"],
  ["foo", "foo"],
  ["fooBar", "fooBar"],
  ["foo_bar", "fooBar"],
  ["userID", "userId"],
  ["userId", "userId"],
  // ["userIDs", "userIds"], // TODO this one is broken
  ["userIds", "userIds"],
  ["user_ids", "userIds"],
  ["user_id", "userId"],
  ["first_name", "firstName"],
  ["firstName", "firstName"],
  ["FirstName", "firstName"],
  ["new_col", "newCol"],
  ["newCol", "newCol"],
  ["new_col2", "newCol2"],
  ["cover_photo", "coverPhoto"],
  ["coverPhoto", "coverPhoto"],
  ["cover_photo2", "coverPhoto2"],
]).test("fieldName", (input: string, expected: string) => {
  expect(toFieldName(input)).toBe(expected);
});

each([
  ["ID", "id"],
  ["id", "id"],
  ["idFoo", "id_foo"],
  ["fooBar", "foo_bar"],
  ["foo_bar", "foo_bar"],
  ["userID", "user_id"],
  ["userId", "user_id"],
  // ["userIDs", "user_ids"], // TODO this one is broken
  ["userIds", "user_ids"],
  ["user_ids", "user_ids"],
  ["user_id", "user_id"],
  ["first_name", "first_name"],
  ["firstName", "first_name"],
  ["FirstName", "first_name"],
  ["new_col", "new_col"],
  ["newCol", "new_col"],
  ["new_col2", "new_col2"],
  ["cover_photo", "cover_photo"],
  ["coverPhoto", "cover_photo"],
  ["cover_photo2", "cover_photo2"],
]).test("dbColumn", (input: string, expected: string) => {
  expect(toDBColumnOrTable(input)).toBe(expected);
});
