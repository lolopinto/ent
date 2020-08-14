import { advanceTo } from "jest-date-mock";
import {
  Builder,
  WriteOperation,
  Trigger,
  Validator,
  Observer,
} from "../action";
import {
  Ent,
  Viewer,
  DataOperation,
  EditNodeOperation,
  DeleteNodeOperation,
  EdgeOperation,
} from "../core/ent";
import * as ent from "../core/ent";
import { LoggedOutViewer, IDViewer } from "../core/viewer";
import { Changeset } from "../action";
import { StringType, TimeType } from "../schema/field";
import { BaseEntSchema, Field } from "../schema";
import {
  User,
  Event,
  Contact,
  SimpleBuilder,
  SimpleAction,
} from "../testutils/builder";
import { FakeComms, Mode } from "../testutils/fake_comms";
import { Pool } from "pg";
import { QueryRecorder } from "../testutils/db_mock";
import { AlwaysAllowRule, DenyIfLoggedInRule } from "../core/privacy";

jest.mock("pg");
QueryRecorder.mockPool(Pool);

afterEach(() => {
  QueryRecorder.clear();
  FakeComms.clear();
});

jest
  .spyOn(ent, "loadEdgeDatas")
  .mockImplementation(QueryRecorder.mockImplOfLoadEdgeDatas);

class UserSchema extends BaseEntSchema {
  fields: Field[] = [
    StringType({ name: "FirstName" }),
    StringType({ name: "LastName" }),
  ];
  ent = User;
}

class UserSchemaWithStatus extends BaseEntSchema {
  fields: Field[] = [
    StringType({ name: "FirstName" }),
    StringType({ name: "LastName" }),
    // let's assume this was hidden from the generated action and has to be set by the builder...
    StringType({ name: "account_status" }),
  ];
  ent = User;
}

class UserSchemaExtended extends BaseEntSchema {
  fields: Field[] = [
    StringType({ name: "FirstName" }),
    StringType({ name: "LastName" }),
    StringType({ name: "account_status" }),
    StringType({ name: "EmailAddress", nullable: true }),
    StringType({ name: "PhoneNumber", nullable: true }),
  ];
  ent = User;
}

class SchemaWithProcessors extends BaseEntSchema {
  fields: Field[] = [
    StringType({ name: "zip" }).match(/^\d{5}(-\d{4})?$/),
    StringType({ name: "username" }).toLowerCase(),
  ];
  ent = User;
}

test("schema on create", async () => {
  const builder = new SimpleBuilder(
    new LoggedOutViewer(),
    new UserSchema(),
    new Map([
      ["FirstName", "Jon"],
      ["LastName", "Snow"],
    ]),
  );

  const fields = await getFieldsFromBuilder(builder);
  expect(fields["first_name"]).toBe("Jon");
  expect(fields["last_name"]).toBe("Snow");
  validateFieldsExist(fields, "id", "created_at", "updated_at");
});

test("missing required field", async () => {
  const builder = new SimpleBuilder(
    new LoggedOutViewer(),
    new UserSchema(),
    new Map([
      ["FirstName", "Jon"],
      // non-nullable field set to null
      // simulating what the generated builder will do
      ["LastName", null],
    ]),
  );

  try {
    await builder.build();
    fail("should have thrown exception");
  } catch (e) {
    expect(e.message).toBe("field LastName set to null for non-nullable field");
  }
});

// if somehow builder logic doesn't handle this, we still catch this for create
// should this be default and simplify builders?
test("required field not set", async () => {
  const builder = new SimpleBuilder(
    new LoggedOutViewer(),
    new UserSchema(),
    new Map([["FirstName", "Jon"]]),
  );

  try {
    await builder.build();
    fail("should have thrown exception");
  } catch (e) {
    expect(e.message).toBe("required field LastName not set");
  }
});

test("schema on edit", async () => {
  const user = new User(new LoggedOutViewer(), "1", { id: "1" });
  const builder = new SimpleBuilder(
    new LoggedOutViewer(),
    new UserSchema(),
    // field that's not changed isn't set...
    // simulating what the generated builder will do
    new Map([["LastName", "Targaryean"]]),
    WriteOperation.Edit,
    user,
  );

  const fields = await getFieldsFromBuilder(builder);
  expect(fields["last_name"]).toBe("Targaryean");
  validateFieldsExist(fields, "updated_at");
  validateFieldsDoNotExist(fields, "id", "created_at");
});

test("schema on delete", async () => {
  const user = new User(new LoggedOutViewer(), "1", { id: "1" });
  const builder = new SimpleBuilder(
    new LoggedOutViewer(),
    new UserSchema(),
    new Map(),
    WriteOperation.Delete,
    user,
  );

  const c = await builder.build();
  const ops = getOperations(c);
  expect(ops.length).toBe(1);
  expect(ops[0]).toBeInstanceOf(DeleteNodeOperation);
});

test("schema with null fields", async () => {
  class SchemaWithNullFields extends BaseEntSchema {
    fields: Field[] = [
      TimeType({ name: "startTime" }),
      TimeType({ name: "endTime", nullable: true }),
    ];
    ent = User;
  }

  const builder = new SimpleBuilder(
    new LoggedOutViewer(),
    new SchemaWithNullFields(),
    new Map([["startTime", new Date()]]),
  );

  const fields = await getFieldsFromBuilder(builder);
  expect(fields["start_time"]).toBeInstanceOf(Date);
  validateFieldsExist(fields, "id", "created_at", "updated_at");
  validateFieldsDoNotExist(fields, "end_time");

  const builder2 = new SimpleBuilder(
    new LoggedOutViewer(),
    new SchemaWithNullFields(),
    new Map([
      ["startTime", new Date()],
      ["endTime", null],
    ]),
  );
  const fields2 = await getFieldsFromBuilder(builder2);
  expect(fields2["start_time"]).toBeInstanceOf(Date);
  expect(fields2["end_time"]).toBe(null);

  validateFieldsExist(fields2, "id", "created_at", "updated_at");
});

test("schema_with_overriden_storage_key", async () => {
  class SchemaWithOverridenDBKey extends BaseEntSchema {
    fields: Field[] = [
      StringType({ name: "emailAddress", storageKey: "email" }),
    ];
    ent = User;
  }

  const builder = new SimpleBuilder(
    new LoggedOutViewer(),
    new SchemaWithOverridenDBKey(),
    new Map([["emailAddress", "test@email.com"]]),
  );

  const fields = await getFieldsFromBuilder(builder);
  expect(fields["email"]).toBe("test@email.com");
  validateFieldsExist(fields, "id", "created_at", "updated_at");
});

describe("schema_with_processors", () => {
  test("simple case", async () => {
    const builder = new SimpleBuilder(
      new LoggedOutViewer(),
      new SchemaWithProcessors(),
      new Map([
        ["username", "lolopinto"],
        ["zip", "94114"],
      ]),
    );

    const fields = await getFieldsFromBuilder(builder);
    expect(fields["username"]).toBe("lolopinto");
    expect(fields["zip"]).toBe("94114");
    validateFieldsExist(fields, "id", "created_at", "updated_at");
  });

  test("username lowered", async () => {
    const builder = new SimpleBuilder(
      new LoggedOutViewer(),
      new SchemaWithProcessors(),
      new Map([
        ["username", "LOLOPINTO"],
        ["zip", "94114"],
      ]),
    );

    const fields = await getFieldsFromBuilder(builder);
    expect(fields["username"]).toBe("lolopinto");
    expect(fields["zip"]).toBe("94114");
    validateFieldsExist(fields, "id", "created_at", "updated_at");
  });

  test("invalid zip", async () => {
    const builder = new SimpleBuilder(
      new LoggedOutViewer(),
      new SchemaWithProcessors(),
      new Map([
        ["username", "LOLOPINTO"],
        ["zip", "941"],
      ]),
    );

    try {
      await builder.build();
      fail("should not have gotten here");
    } catch (e) {
      expect(e.message).toBe("invalid field zip with value 941");
    }
  });
});

test("inbound edge", async () => {
  const viewer = new IDViewer("1");
  const user = new User(viewer, "1", { id: "1" });
  const builder = new SimpleBuilder(
    viewer,
    new UserSchema(),
    new Map(),
    WriteOperation.Edit,
    user, // TODO enforce existing ent if not create
  );
  builder.orchestrator.addInboundEdge("2", "edge", "User");

  const edgeOp = await getEdgeOpFromBuilder(builder, 2, "edge");
  expect(edgeOp.edgeInput).toStrictEqual({
    id1: "2",
    id1Type: "User",
    edgeType: "edge",
    id2: "1",
    id2Type: "User",
  });
});

test("outbound edge", async () => {
  const viewer = new IDViewer("1");
  const user = new User(viewer, "1", { id: "1" });
  const builder = new SimpleBuilder(
    viewer,
    new UserSchema(),
    new Map(),
    WriteOperation.Edit,
    user, // TODO enforce existing ent if not create
  );
  builder.orchestrator.addOutboundEdge("2", "edge", "User");

  const edgeOp = await getEdgeOpFromBuilder(builder, 2, "edge");
  expect(edgeOp.edgeInput).toStrictEqual({
    id1: "1",
    id1Type: "User",
    edgeType: "edge",
    id2: "2",
    id2Type: "User",
  });
});

describe("remove inbound edge", () => {
  test("existing ent", async () => {
    const viewer = new IDViewer("1");
    const user = new User(viewer, "1", { id: "1" });
    const builder = new SimpleBuilder(
      viewer,
      new UserSchema(),
      new Map(),
      WriteOperation.Edit,
      user, // TODO enforce existing ent if not create
    );
    builder.orchestrator.removeInboundEdge("2", "edge");

    const edgeOp = await getEdgeOpFromBuilder(builder, 2, "edge");
    expect(edgeOp.edgeInput).toStrictEqual({
      id1: "2",
      edgeType: "edge",
      id2: "1",
      id1Type: "", // not useful so we don't care
      id2Type: "",
    });
  });

  test("no ent", async () => {
    const builder = new SimpleBuilder(
      new LoggedOutViewer(),
      new UserSchema(),
      new Map(),
      WriteOperation.Edit,
    );
    builder.orchestrator.removeInboundEdge("2", "edge");

    try {
      await builder.build();

      fail("should not get here");
    } catch (e) {
      expect(e.message).toBe("existing ent required with operation");
    }
  });
});

describe("remove outbound edge", () => {
  test("existing ent", async () => {
    const viewer = new IDViewer("1");
    const user = new User(viewer, "1", { id: "1" });
    const builder = new SimpleBuilder(
      viewer,
      new UserSchema(),
      new Map(),
      WriteOperation.Edit,
      user, // TODO enforce existing ent if not create
    );
    builder.orchestrator.removeOutboundEdge("2", "edge");

    const edgeOp = await getEdgeOpFromBuilder(builder, 2, "edge");
    expect(edgeOp.edgeInput).toStrictEqual({
      id1: "1",
      edgeType: "edge",
      id2: "2",
      id1Type: "", // not useful so we don't care
      id2Type: "",
    });
  });

  test("no ent", async () => {
    const builder = new SimpleBuilder(
      new LoggedOutViewer(),
      new UserSchema(),
      new Map(),
      WriteOperation.Edit,
    );
    builder.orchestrator.removeOutboundEdge("2", "edge");

    try {
      await builder.build();
      fail("should not get here");
    } catch (e) {
      expect(e.message).toBe("existing ent required with operation");
    }
  });
});

describe("validators", () => {
  class EventSchema extends BaseEntSchema {
    fields: Field[] = [
      TimeType({ name: "startTime" }),
      TimeType({ name: "endTime" }),
    ];
    ent = Event;
  }

  const validators: Validator<Event>[] = [
    {
      validate: async (builder: SimpleBuilder<Event>): Promise<void> => {
        let startTime: Date = builder.fields.get("startTime");
        let endTime: Date = builder.fields.get("endTime");

        if (!startTime || !endTime) {
          throw new Error("startTime and endTime required");
        }

        if (startTime.getTime() > endTime.getTime()) {
          throw new Error("start time cannot be after end time");
        }
      },
    },
  ];

  test("invalid", async () => {
    let now = new Date();
    let yesterday = new Date(now.getTime() - 86400);

    let action = new SimpleAction(
      new LoggedOutViewer(),
      new EventSchema(),
      new Map([
        ["startTime", now],
        ["endTime", yesterday],
      ]),
      WriteOperation.Insert,
    );
    action.validators = validators;

    try {
      await action.validX();
      fail("should have thrown exception");
    } catch (e) {
      expect(e.message).toBe("start time cannot be after end time");
    }
  });

  test("valid", async () => {
    let now = new Date();
    let yesterday = new Date(now.getTime() - 86400);

    let action = new SimpleAction(
      new LoggedOutViewer(),
      new EventSchema(),
      new Map([
        ["startTime", yesterday],
        ["endTime", now],
      ]),
      WriteOperation.Insert,
    );
    action.validators = validators;

    await action.validX();

    // can "save" the query!
    await action.saveX();
  });
});

describe("privacyPolicy", () => {
  test("valid simple policy", async () => {
    let action = new SimpleAction(
      new LoggedOutViewer(),
      new UserSchema(),
      new Map([
        ["FirstName", "Jon"],
        ["LastName", "Snow"],
      ]),
      WriteOperation.Insert,
    );
    action.privacyPolicy = {
      rules: [DenyIfLoggedInRule, AlwaysAllowRule],
    };
    let valid = await action.valid();
    expect(valid).toBe(true);
  });

  test("invalid simple policy", async () => {
    const viewer = new IDViewer("1");
    const action = new SimpleAction(
      viewer,
      new UserSchema(),
      new Map([
        ["FirstName", "Jon"],
        ["LastName", "Snow"],
      ]),
      WriteOperation.Insert,
    );
    action.privacyPolicy = {
      rules: [DenyIfLoggedInRule, AlwaysAllowRule],
    };
    let valid = await action.valid();
    expect(valid).toBe(false);
  });
});

describe("trigger", () => {
  let now = new Date();

  const accountStatusTrigger = {
    changeset: (builder: SimpleBuilder<User>): void => {
      builder.fields.set("account_status", "VALID");
    },
  };
  const triggers: Trigger<User>[] = [accountStatusTrigger];

  test("update builder", async () => {
    advanceTo(now);
    const viewer = new IDViewer("11");
    const action = new SimpleAction(
      viewer,
      new UserSchemaWithStatus(),
      new Map([
        ["FirstName", "Jon"],
        ["LastName", "Snow"],
      ]),
      WriteOperation.Insert,
    );

    action.triggers = triggers;
    const user = await action.saveX();
    if (!user) {
      fail("couldn't save user");
    }

    expect(user.data).toStrictEqual({
      id: user.id,
      created_at: now,
      updated_at: now,
      first_name: "Jon",
      last_name: "Snow",
      account_status: "VALID",
    });
  });

  test("new changeset", async () => {
    advanceTo(now);
    class ContactSchema extends BaseEntSchema {
      fields: Field[] = [
        StringType({ name: "FirstName" }),
        StringType({ name: "LastName" }),
        StringType({ name: "UserID" }),
      ];
      ent = Contact;
    }

    const viewer = new IDViewer("1");
    let contactAction: SimpleAction<Contact>;
    const action = new SimpleAction(
      viewer,
      new UserSchemaWithStatus(),
      new Map([
        ["FirstName", "Jon"],
        ["LastName", "Snow"],
      ]),
      WriteOperation.Insert,
    );
    // also create a contact when we create a user
    action.triggers = [
      accountStatusTrigger,
      {
        changeset: (
          builder: SimpleBuilder<User>,
        ): Promise<Changeset<Contact>> => {
          let firstName = builder.fields.get("FirstName");
          let lastName = builder.fields.get("LastName");
          contactAction = new SimpleAction(
            viewer,
            new ContactSchema(),
            new Map([
              ["FirstName", firstName],
              ["LastName", lastName],
              ["UserID", builder],
            ]),
            WriteOperation.Insert,
          );
          return contactAction.changeset();
        },
      },
    ];

    // this returned a Contact not a User
    // this didn't replace the builder
    const user = await action.saveX();
    if (!user) {
      fail("couldn't save user");
    }
    expect(user.data).toStrictEqual({
      id: user.id,
      created_at: now,
      updated_at: now,
      first_name: "Jon",
      last_name: "Snow",
      account_status: "VALID",
    });

    // let's inspect the created contact
    expect(contactAction!).not.toBe(null);
    let contact = await contactAction!.builder.orchestrator.editedEnt();
    if (!contact) {
      fail("couldn't save contact");
    }
    expect(contact.data).toStrictEqual({
      id: contact.id,
      created_at: now,
      updated_at: now,
      first_name: "Jon",
      last_name: "Snow",
      user_id: user.id, // created contact and set the user_id correctly
    });
  });
});

let sendEmailObserver: Observer<User> = {
  observe: (builder: SimpleBuilder<User>): void => {
    let email = builder.fields.get("EmailAddress");
    if (!email) {
      return;
    }
    let firstName = builder.fields.get("FirstName");
    FakeComms.send({
      from: "noreply@foo.com",
      to: email,
      subject: `Welcome, ${firstName}!`,
      body: `Hi ${firstName}, thanks for joining fun app!`,
      mode: Mode.EMAIL,
    });
  },
};

describe("observer", () => {
  let now = new Date();

  test("no email sent", async () => {
    advanceTo(now);
    const viewer = new IDViewer("11");
    const action = new SimpleAction(
      viewer,
      new UserSchemaExtended(),
      new Map([
        ["FirstName", "Jon"],
        ["LastName", "Snow"],
        ["account_status", "UNVERIFIED"],
      ]),
      WriteOperation.Insert,
    );
    action.observers = [sendEmailObserver];

    const user = await action.saveX();
    if (!user) {
      fail("couldn't save user");
    }

    expect(user.data).toStrictEqual({
      id: user.id,
      created_at: now,
      updated_at: now,
      first_name: "Jon",
      last_name: "Snow",
      account_status: "UNVERIFIED",
    });
    FakeComms.verifyNoEmailSent();
  });

  test("email sent", async () => {
    advanceTo(now);
    const viewer = new IDViewer("11");
    const action = new SimpleAction(
      viewer,
      new UserSchemaExtended(),
      new Map([
        ["FirstName", "Jon"],
        ["LastName", "Snow"],
        ["EmailAddress", "foo@email.com"],
        ["account_status", "UNVERIFIED"],
      ]),
      WriteOperation.Insert,
    );
    action.observers = [sendEmailObserver];

    const user = await action.saveX();
    if (!user) {
      fail("couldn't save user");
    }

    expect(user.data).toStrictEqual({
      id: user.id,
      created_at: now,
      updated_at: now,
      first_name: "Jon",
      last_name: "Snow",
      email_address: "foo@email.com",
      account_status: "UNVERIFIED",
    });

    FakeComms.verifySent("foo@email.com", Mode.EMAIL, {
      subject: "Welcome, Jon!",
      body: "Hi Jon, thanks for joining fun app!",
    });
  });
});

describe("combo", () => {
  const createAction = (
    viewer: Viewer,
    fields: Map<string, any>,
  ): SimpleAction<User> => {
    const action = new SimpleAction(
      viewer,
      new UserSchemaExtended(),
      fields,
      WriteOperation.Insert,
    );
    action.triggers = [
      {
        changeset: (builder: SimpleBuilder<User>): void => {
          builder.fields.set("account_status", "VALID");
        },
      },
    ];
    action.privacyPolicy = {
      rules: [DenyIfLoggedInRule, AlwaysAllowRule],
    };
    action.validators = [
      {
        validate: async (builder: SimpleBuilder<User>): Promise<void> => {
          let fields = builder.fields;
          if (fields.get("LastName") !== "Snow") {
            throw new Error("only Jon Snow's name is valid");
          }
        },
      },
    ];
    action.observers = [sendEmailObserver];
    return action;
  };

  test("success", async () => {
    let now = new Date();
    let action = createAction(
      new LoggedOutViewer(),
      new Map([
        ["FirstName", "Jon"],
        ["LastName", "Snow"],
      ]),
    );
    advanceTo(now);

    const user = await action.saveX();
    if (!user) {
      fail("couldn't save user");
    }

    expect(user.data).toStrictEqual({
      id: user.id,
      created_at: now,
      updated_at: now,
      first_name: "Jon",
      last_name: "Snow",
      account_status: "VALID",
    });
    FakeComms.verifyNoEmailSent();
  });

  test("success with email", async () => {
    let now = new Date();
    let action = createAction(
      new LoggedOutViewer(),
      new Map([
        ["FirstName", "Jon"],
        ["LastName", "Snow"],
        ["EmailAddress", "foo@email.com"],
      ]),
    );
    advanceTo(now);

    const user = await action.saveX();
    if (!user) {
      fail("couldn't save user");
    }

    expect(user.data).toStrictEqual({
      id: user.id,
      created_at: now,
      updated_at: now,
      first_name: "Jon",
      last_name: "Snow",
      account_status: "VALID",
      email_address: "foo@email.com",
    });
    FakeComms.verifySent("foo@email.com", Mode.EMAIL, {
      subject: "Welcome, Jon!",
      body: "Hi Jon, thanks for joining fun app!",
    });
  });

  test("privacy", async () => {
    let action = createAction(
      new IDViewer("1"),
      new Map([
        ["FirstName", "Jon"],
        ["LastName", "Snow"],
        ["EmailAddress", "foo@email.com"],
      ]),
    );

    try {
      await action.saveX();
      fail("expected error");
    } catch (err) {
      expect(err.message).toMatch(/is not visible for privacy reasons$/);
    }
    FakeComms.verifyNoEmailSent();
  });

  test("privacy no exceptions", async () => {
    let action = createAction(
      new IDViewer("1"),
      new Map([
        ["FirstName", "Jon"],
        ["LastName", "Snow"],
        ["EmailAddress", "foo@email.com"],
      ]),
    );

    let ent = await action.save();
    expect(ent).toBe(null);
    FakeComms.verifyNoEmailSent();
  });
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

async function getFieldsFromBuilder<T extends Ent>(
  builder: Builder<T>,
  expLength: number = 1,
): Promise<{}> {
  const c = await builder.build();
  const ops = getOperations(c);
  expect(ops.length).toBe(expLength);
  for (const op of ops) {
    const options = (op as EditNodeOperation).options;
    if (options !== undefined) {
      return options.fields;
    }
  }
  fail("couldn't find EditNodeOperation where fields are being edited");
}

async function getEdgeOpFromBuilder<T extends Ent>(
  builder: Builder<T>,
  expLength: number,
  edgeType: string,
): Promise<EdgeOperation> {
  const c = await builder.build();
  const ops = getOperations(c);
  expect(ops.length).toBe(expLength);
  //  console.log(ops);
  for (const op of ops) {
    if ((op as EdgeOperation).edgeInput !== undefined) {
      //      console.log(op);
      // todo add more things to differentiate this by
      const edgeOp = (op as EdgeOperation)!;
      if (edgeOp.edgeInput.edgeType === edgeType) {
        return edgeOp;
      }
    }
  }
  fail(`could not find edge operation with edgeType ${edgeType}`);
}
