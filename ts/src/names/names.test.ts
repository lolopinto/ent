import each from "jest-each";
import { toFieldName, toDBColumnOrTable, _splitCamelCase } from "./names";

each([
  ["ID", "id"],
  ["id", "id"],
  ["foo", "foo"],
  ["fooBar", "fooBar"],
  ["foo_bar", "fooBar"],
  ["userID", "userId"],
  ["userId", "userId"],
  ["userIDs", "userIds"],
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
  ["userIDs", "user_ids"],
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

each([
  ["", []],
  ["lowercase", ["lowercase"]],
  ["Class", ["Class"]],
  ["MyClass", ["My", "Class"]],
  ["MyC", ["My", "C"]],
  ["HTML", ["HTML"]],
  ["PDFLoader", ["PDF", "Loader"]],
  ["AString", ["A", "String"]],
  ["SimpleXMLParser", ["Simple", "XML", "Parser"]],
  ["vimRPCPlugin", ["vim", "RPC", "Plugin"]],
  ["GL11Version", ["GL", "11", "Version"]],
  ["99Bottles", ["99", "Bottles"]],
  ["May5", ["May", "5"]],
  ["BFG9000", ["BFG", "9000"]],
  ["Two  spaces", ["Two", "  ", "spaces"]],
  ["192ndDay", ["192nd", "Day"]],
  ["userIDs", ["user", "ID", "s"]],
  ["Ms", ["Ms"]],
]).test("splitCameCase", (input: string, expected: string[]) => {
  // doesn't handle or test the unicode cases
  expect(_splitCamelCase(input).map((r) => r.s)).toEqual(expected);
});
