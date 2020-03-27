import { Orchestrator } from "./orchestrator";
import { Builder, WriteOperation } from "./action";
import {
  Viewer,
  Ent,
  ID,
  EntConstructor,
  DataOperation,
  CreateRowOperation,
} from "./ent";
import { PrivacyPolicy, AlwaysAllowRule } from "./privacy";
import { LoggedOutViewer } from "./viewer";
import { Changeset } from "./action";
import { StringType } from "./field";
import { BaseEntSchema, Field } from "./schema";

class User implements Ent {
  id: ID;
  accountID: string;
  nodeType: "User";
  privacyPolicy: PrivacyPolicy = {
    rules: [AlwaysAllowRule],
  };
  constructor(public viewer: Viewer, data: {}) {
    this.id = data["id"];
  }
}

class SimpleBuilder implements Builder<User> {
  existingEnt: null;
  ent: EntConstructor<User>;
  placeholderID: "1";
  viewer: Viewer;
  //  operation: WriteOperation;
  private orchestrator: Orchestrator<User>;

  constructor(
    private schema: any,
    private fields: Map<string, any>,
    public operation: WriteOperation = WriteOperation.Insert,
  ) {
    this.viewer = new LoggedOutViewer();
    this.orchestrator = new Orchestrator({
      viewer: this.viewer,
      operation: operation,
      tableName: "foo",
      ent: User,
      builder: this,
      schema: this.schema,
      editedFields: () => {
        return this.fields;
      },
    });
  }

  build(): Promise<Changeset<User>> {
    return this.orchestrator.build();
  }
}

class UserSchema extends BaseEntSchema {
  fields: Field[] = [
    StringType({ name: "FirstName" }),
    StringType({ name: "LastName" }),
  ];
}

test("schema on create", async () => {
  const builder = new SimpleBuilder(
    UserSchema,
    new Map([
      ["FirstName", "Jon"],
      ["LastName", "Snow"],
    ]),
  );

  const c = await builder.build();
  const ops = getOperations(c);
  expect(ops.length).toBe(1);
  const rowOp = ops[0];
  expect(rowOp).toBeInstanceOf(CreateRowOperation);
  const fields = (rowOp as CreateRowOperation)!.options.fields;
  expect(fields["first_name"]).toBe("Jon");
  expect(fields["last_name"]).toBe("Snow");
  validateFieldsExist(fields, "id", "created_at", "updated_at");
});

test("missing required field", async () => {
  const builder = new SimpleBuilder(
    UserSchema,
    new Map([
      ["FirstName", "Jon"],
      // non-nullable field set to null
      // simulating what the generated builder will do
      ["LastName", null],
    ]),
  );

  try {
    await builder.build();
  } catch (e) {
    expect(e.message).toBe("field LastName set to null for non-nullable field");
  }
});

test("schema on edit", async () => {
  const builder = new SimpleBuilder(
    UserSchema,
    // field that's not changed isn't set...
    // simulating what the generated builder will do
    new Map([["LastName", "Targaryean"]]),
    WriteOperation.Edit,
  );

  const c = await builder.build();
  const ops = getOperations(c);
  expect(ops.length).toBe(1);
  const rowOp = ops[0];
  expect(rowOp).toBeInstanceOf(CreateRowOperation);
  const fields = (rowOp as CreateRowOperation)!.options.fields;
  expect(fields["last_name"]).toBe("Targaryean");
  validateFieldsExist(fields, "updated_at");
  validateFieldsDoNotExist(fields, "id", "created_at");
});

function validateFieldsExist(fields: {}, ...names: string[]) {
  for (const name of names) {
    expect(fields[name], `field ${name}`).not.toBe(undefined);
  }
}

function validateFieldsDoNotExist(fields: {}, ...names: string[]) {
  for (const name of names) {
    expect(fields[name], `field ${name}`).toBe(undefined);
  }
}

function getOperations<T extends Ent>(c: Changeset<T>): DataOperation[] {
  let ops: DataOperation[] = [];
  for (let op of c.executor()) {
    ops.push(op);
  }
  return ops;
}
