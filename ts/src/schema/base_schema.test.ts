import { Node, EntSchemaWithTZ, Timestamps } from "./base_schema";

test("all timestamp patterns defer updatedAt until another field is set", () => {
  for (const pattern of [
    Timestamps,
    Node,
    new EntSchemaWithTZ({ fields: {} }).patterns[0],
  ]) {
    const fields = pattern.fields;
    expect(fields.updatedAt.onlyUpdateIfOtherFieldsBeingSet_BETA).toBe(true);
    expect(fields.updatedAt.disableUserEditable).toBe(true);
    expect(fields.updatedAt.defaultValueOnEdit).toBeDefined();
  }
});
