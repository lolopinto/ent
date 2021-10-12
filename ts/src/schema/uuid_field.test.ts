import { UUIDType } from "./field";
import { DBType, PolymorphicOptions, Type, FieldOptions } from "./schema";

test("polymorphic true", () => {
  doTest(true, {
    dbType: DBType.String,
  });
});

test("polymorphic true nullable true", () => {
  doTest(
    true,
    {
      dbType: DBType.String,
    },
    {
      nullable: true,
    },
  );
});

test("polymorphic object", () => {
  doTest(
    { types: ["User", "Post"] },
    {
      dbType: DBType.StringEnum,
      values: ["User", "Post"],
      type: "fooType",
      graphQLType: "fooType",
      enumMap: undefined,
    },
  );
});

test("polymorphic object, nullable true", () => {
  doTest(
    { types: ["User", "Post"] },
    {
      dbType: DBType.StringEnum,
      values: ["User", "Post"],
      type: "fooType",
      graphQLType: "fooType",
      enumMap: undefined,
    },
    {
      nullable: true,
    },
  );
});

function doTest(
  polymorphic: boolean | PolymorphicOptions,
  expDerivedType: Type,
  opts?: Partial<FieldOptions>,
) {
  const f = UUIDType({ name: "fooID", polymorphic: polymorphic, ...opts });
  expect(f.derivedFields?.length).toBe(1);
  const derived = f.derivedFields![0];
  expect(derived.type).toStrictEqual(expDerivedType);
  expect(derived.nullable).toBe(opts?.nullable);
}
