import { Ent, ID, Viewer, Data } from "../core/base";
import { DataOperation } from "../core/ent";
import {
  Action,
  Builder,
  Changeset,
  Executor,
  WriteOperation,
  Trigger,
  Observer,
} from "../action";
import * as action from "../action";
import { executeOperations } from "../action/executor";

import { Dialect } from "../core/db";

import { Pool } from "pg";
import { QueryRecorder, queryType } from "../testutils/db_mock";
import {
  User,
  Group,
  Message,
  Contact,
  SimpleBuilder,
  SimpleAction,
} from "../testutils/builder";
import { LoggedOutViewer, IDViewer } from "../core/viewer";
import { BaseEntSchema, Field } from "../schema";
import {
  StringType,
  TimestampType,
  BooleanType,
  UUIDType,
} from "../schema/field";
import { ListBasedExecutor, ComplexExecutor } from "./executor";
import { FakeLogger, EntCreationObserver } from "../testutils/fake_log";
import { createRowForTest } from "../testutils/write";
import { AlwaysAllowPrivacyPolicy } from "../core/privacy";
import { BaseAction } from "./experimental_action";
import { MockLogs } from "../testutils/mock_log";
import { setLogLevels } from "../core/logger";
import {
  assoc_edge_config_table,
  assoc_edge_table,
  getSchemaTable,
  setupSqlite,
  Table,
} from "../testutils/db/test_db";

jest.mock("pg");
QueryRecorder.mockPool(Pool);

const ml = new MockLogs();
let operations: DataOperation[] = [];

const edges = [
  "fake_edge",
  "selfContact",
  "channelMember",
  "senderToMessage",
  "workspaceMember",
  "recipientToMessage",
];

beforeEach(async () => {
  // does assoc_edge_config loader need to be cleared?
  for (const edge of edges) {
    await createRowForTest({
      tableName: "assoc_edge_config",
      fields: {
        edge_table: `${edge}_table`,
        symmetric_edge: false,
        inverse_edge_type: null,
        edge_type: edge,
        edge_name: "name",
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
  }
  QueryRecorder.clearQueries();
  ml.clear();
});

beforeAll(() => {
  setLogLevels(["query", "error"]);
  ml.mock();
});

afterEach(() => {
  ml.clear();
});

afterAll(() => {
  ml.restore();
});
afterEach(() => {
  QueryRecorder.clear();
  FakeLogger.clear();
  operations = [];
});

describe("postgres", () => {
  commonTests();
});

describe("sqlite", () => {
  const getTables = () => {
    const tables: Table[] = [assoc_edge_config_table()];
    edges.map((edge) => tables.push(assoc_edge_table(`${edge}_table`)));

    [
      new AccountSchema(),
      new ContactSchema(),
      new GroupSchema(),
      new UserSchema(),
      new MessageSchema(),
    ].map((s) => tables.push(getSchemaTable(s, Dialect.SQLite)));
    return tables;
  };

  setupSqlite(`sqlite:///executor-test.db`, getTables);
  commonTests();
});

jest.spyOn(action, "saveBuilder").mockImplementation(saveBuilder);

async function saveBuilder<T extends Ent>(builder: Builder<T>): Promise<void> {
  const changeset = await builder.build();
  const executor = changeset.executor();
  operations = await executeOperations(executor, builder.viewer.context, true);
}

async function executeAction<T extends Ent, E = any>(
  action: Action<T>,
  name?: E,
): Promise<Executor> {
  const exec = await executor(action.builder);
  if (name !== undefined) {
    expect(exec).toBeInstanceOf(name);
  }
  operations = await executeOperations(
    exec,
    action.builder.viewer.context,
    true,
  );
  return exec;
}

async function executor<T extends Ent>(builder: Builder<T>): Promise<Executor> {
  const changeset = await builder.build();
  return changeset.executor();
}

async function createGroup() {
  let groupID = QueryRecorder.newID();
  let groupFields = {
    id: groupID,
    name: "group",
    created_at: new Date(),
    updated_at: new Date(),
  };
  // need to create the group first
  await createRowForTest({
    tableName: "groups",
    fields: groupFields,
  });
  return new Group(new LoggedOutViewer(), groupFields);
}

class UserSchema extends BaseEntSchema {
  fields: Field[] = [
    StringType({ name: "FirstName" }),
    StringType({ name: "LastName" }),
    StringType({ name: "EmailAddress", nullable: true }),
    UUIDType({ name: "AccountID", nullable: true }),
  ];
  ent = User;
}

class Account implements Ent {
  id: ID;
  accountID: string = "";
  nodeType = "Account";
  privacyPolicy = AlwaysAllowPrivacyPolicy;

  constructor(public viewer: Viewer, public data: Data) {
    this.id = data.id;
  }
}

class AccountSchema extends BaseEntSchema {
  ent = Account;
  fields: Field[] = [];
}

class ContactSchema extends BaseEntSchema {
  fields: Field[] = [
    StringType({ name: "FirstName" }),
    StringType({ name: "LastName" }),
    StringType({ name: "UserID" }),
  ];
  ent = Contact;
}

class GroupSchema extends BaseEntSchema {
  fields: Field[] = [
    StringType({ name: "name" }),
    StringType({ name: "funField", nullable: true }),
  ];
  ent = Group;
}

class MessageSchema extends BaseEntSchema {
  fields: Field[] = [
    // TODO both id fields
    StringType({ name: "sender" }), // can't use from
    StringType({ name: "recipient" }), // can't use to in sqlite
    StringType({ name: "message" }),
    BooleanType({ name: "transient", nullable: true }),
    TimestampType({ name: "expiresAt", nullable: true }),
  ];
  ent = Message;
}

class MessageAction extends SimpleAction<Message> {
  constructor(
    viewer: Viewer,
    fields: Map<string, any>,
    operation: WriteOperation,
    existingEnt?: Message,
  ) {
    super(viewer, new MessageSchema(), fields, operation, existingEnt);
  }

  triggers: Trigger<Message>[] = [
    {
      changeset: (builder: SimpleBuilder<Message>, _input: Data): void => {
        let sender = builder.fields.get("sender");
        let recipient = builder.fields.get("recipient");

        builder.orchestrator.addInboundEdge(sender, "senderToMessage", "user");
        builder.orchestrator.addInboundEdge(
          recipient,
          "recipientToMessage",
          "user",
        );
      },
    },
  ];

  observers: Observer<Message>[] = [new EntCreationObserver<Message>()];
}

class UserAction extends SimpleAction<User> {
  contactAction: SimpleAction<Contact> | undefined;

  constructor(
    viewer: Viewer,
    fields: Map<string, any>,
    operation: WriteOperation,
    existingEnt?: User,
  ) {
    super(viewer, new UserSchema(), fields, operation, existingEnt);
  }

  triggers: Trigger<User>[] = [
    {
      changeset: (
        builder: SimpleBuilder<User>,
      ): Promise<Changeset<Contact>> => {
        let firstName = builder.fields.get("FirstName");
        let lastName = builder.fields.get("LastName");
        this.contactAction = new SimpleAction(
          builder.viewer,
          new ContactSchema(),
          new Map([
            ["FirstName", firstName],
            ["LastName", lastName],
            ["UserID", builder],
          ]),
          WriteOperation.Insert,
        );

        this.contactAction.observers = [new EntCreationObserver<Contact>()];

        builder.orchestrator.addOutboundEdge(
          this.contactAction.builder,
          "selfContact",
          "contact",
        );
        return this.contactAction.changeset();
      },
    },
  ];

  observers: Observer<User>[] = [new EntCreationObserver<User>()];
}

function randomEmail(): string {
  const rand = Math.random().toString(16).substring(2);

  return `test+${rand}@email.com`;
}

function commonTests() {
  test("empty", async () => {
    const action = new SimpleAction(
      new LoggedOutViewer(),
      new UserSchema(),
      new Map([
        ["FirstName", "Jon"],
        ["LastName", "Snow"],
      ]),
      WriteOperation.Insert,
    );
    const user = await action.saveX();
    ml.clear();

    const viewer = new LoggedOutViewer();

    const builder = new SimpleBuilder(
      viewer,
      new UserSchema(),
      new Map(),
      WriteOperation.Edit,
      user,
    );

    let ent = await builder.save();
    expect(ent).toBeUndefined();
    // TODO for now it's the EditNodeOperation but we should skip it when no fields
    expect(operations.length).toBe(1);
  });

  test("simple-one-op-created-ent", async () => {
    const action = new SimpleAction(
      new LoggedOutViewer(),
      new UserSchema(),
      new Map([
        ["FirstName", "Jon"],
        ["LastName", "Snow"],
      ]),
      WriteOperation.Insert,
    );

    const exec = await executeAction(action, ListBasedExecutor);

    let ent = await action.editedEnt();
    expect(ent).not.toBe(null);
    expect(exec.resolveValue(action.builder.placeholderID)).toStrictEqual(ent);
    expect(exec.resolveValue(ent?.id)).toBe(null);

    expect(operations.length).toBe(1);

    QueryRecorder.validateQueryStructuresFromLogs(
      ml,
      [
        {
          tableName: "users",
          type: queryType.INSERT,
        },
      ],
      true,
    );
  });

  test("simple-one-op-no-created-ent", async () => {
    let id = QueryRecorder.newID();
    await createRowForTest({
      tableName: "users",
      fields: {
        id: id,
        created_at: new Date(),
        updated_at: new Date(),
        first_name: "Sansa",
        last_name: "Stark",
      },
    });
    ml.clear();
    const viewer = new IDViewer(id);
    const user = new User(viewer, { id });
    const action = new SimpleAction(
      viewer,
      new UserSchema(),
      new Map(),
      WriteOperation.Edit,
      user,
    );
    const id2 = QueryRecorder.newID();

    action.builder.orchestrator.addOutboundEdge(id2, "fake_edge", "user");

    const exec = await executeAction(action, ListBasedExecutor);
    let ent = await action.editedEnt();
    expect(ent).not.toBe(null);
    expect(exec.resolveValue(action.builder.placeholderID)).toStrictEqual(ent);

    expect(operations.length).toBe(2);
    QueryRecorder.validateQueryStructuresFromLogs(
      ml,
      [
        {
          // TODO this shouldn't be here...
          tableName: "users",
          type: queryType.UPDATE,
        },
        {
          tableName: "fake_edge_table",
          type: queryType.INSERT,
        },
      ],
      // skipping assoc_edge_config load and potentially sqlite select *
      true,
    );
  });

  test("list-based-with-dependency", async () => {
    let userBuilder = new SimpleBuilder(
      new LoggedOutViewer(),
      new UserSchema(),
      new Map([
        ["FirstName", "Jon"],
        ["LastName", "Snow"],
      ]),
      WriteOperation.Insert,
    );
    let firstName = userBuilder.fields.get("FirstName");
    let lastName = userBuilder.fields.get("LastName");
    let contactAction = new SimpleAction(
      userBuilder.viewer,
      new ContactSchema(),
      new Map([
        ["FirstName", firstName],
        ["LastName", lastName],
        ["UserID", userBuilder],
      ]),
      WriteOperation.Insert,
    );

    try {
      // list based executor because dependencies but no changesets
      // can't actually run this on its own but that's expected
      await executeAction(contactAction, ListBasedExecutor);
      fail("should not have gotten here");
    } catch (e) {
      expect(e.message).toBe(
        `couldn't resolve field \`user_id\` with value ${userBuilder.placeholderID}`,
      );
    }
  });

  test("complex-based-with-dependencies", async () => {
    const action = new UserAction(
      new LoggedOutViewer(),
      new Map([
        ["FirstName", "Jon"],
        ["LastName", "Snow"],
      ]),
      WriteOperation.Insert,
    );

    // expect ComplexExecutor because of complexity of what we have here
    const exec = await executeAction(action, ComplexExecutor);

    let [user, contact] = await Promise.all([
      action.editedEnt(),
      action.contactAction!.editedEnt(),
    ]);
    expect(operations.length).toBe(3);
    expect(user).toBeInstanceOf(User);
    expect(contact).toBeInstanceOf(Contact);

    expect(
      exec.resolveValue(action.contactAction!.builder.placeholderID),
    ).toStrictEqual(contact);
    expect(exec.resolveValue(action.builder.placeholderID)).toStrictEqual(user);

    QueryRecorder.validateQueryStructuresFromLogs(
      ml,
      [
        {
          tableName: "users",
          type: queryType.INSERT,
        },
        {
          tableName: "contacts",
          type: queryType.INSERT,
        },
        {
          tableName: "selfContact_table",
          type: queryType.INSERT,
        },
      ],
      true,
    );
    FakeLogger.verifyLogs(2);
    expect(FakeLogger.contains(`ent User created with id ${user?.id}`)).toBe(
      true,
    );
    expect(
      FakeLogger.contains(`ent Contact created with id ${contact?.id}`),
    ).toBe(true);
  });

  // this is the join a slack workspace and autojoin channels flow
  // this also creates a contact for the user
  // combines the slack + social contact management app flows into one just for complicated-ness
  test("list-with-complex-layers", async () => {
    async function fetchUserName() {
      return {
        firstName: "Sansa",
        lastName: "Stark",
        emailAddress: randomEmail(),
      };
    }
    async function getAutoJoinChannels() {
      return [
        {
          name: "#general",
          id: QueryRecorder.newID(),
        },
        {
          name: "#random",
          id: QueryRecorder.newID(),
        },
        {
          name: "#fun",
          id: QueryRecorder.newID(),
        },
      ];
    }
    async function getInvitee(viewer: Viewer): Promise<User> {
      return new User(viewer, { id: QueryRecorder.newID() });
    }

    const group = await createGroup();
    ml.clear();

    let userAction: UserAction;
    let messageAction: SimpleAction<Message>;

    const action = new SimpleAction(
      new LoggedOutViewer(),
      new GroupSchema(),
      new Map(),
      WriteOperation.Edit,
      group,
    );

    action.triggers = [
      {
        changeset: async (
          builder: SimpleBuilder<Group>,
        ): Promise<Changeset<any>[]> => {
          let [userInfo, autoJoinChannels, invitee] = await Promise.all([
            fetchUserName(),
            getAutoJoinChannels(),
            getInvitee(builder.viewer),
          ]);
          userAction = new UserAction(
            builder.viewer,
            new Map([
              ["FirstName", userInfo.firstName],
              ["LastName", userInfo.lastName],
              ["EmailAddress", userInfo.emailAddress],
            ]),
            WriteOperation.Insert,
          );

          for (let channel of autoJoinChannels) {
            // user -> channel edge (channel Member)
            userAction.builder.orchestrator.addOutboundEdge(
              channel.id,
              "channelMember",
              "Channel",
            );
          }

          // workspaceMemeer
          // inbound edge from user -> group
          action.builder.orchestrator.addInboundEdge(
            userAction.builder,
            "workspaceMember",
            "user",
          );

          messageAction = new MessageAction(
            builder.viewer,
            new Map<string, any>([
              ["sender", userAction.builder],
              ["recipient", invitee.id],
              ["message", `${userInfo.firstName} has joined!`],
              ["transient", true],
              ["expiresAt", new Date().setTime(new Date().getTime() + 86400)],
            ]),
            WriteOperation.Insert,
          );

          return await Promise.all([
            userAction.changeset(),
            messageAction.changeset(),
          ]);
        },
      },
    ];
    action.observers = [new EntCreationObserver<Group>()];

    // expect ComplexExecutor because of complexity of what we have here
    // we have a Group action which has nested things in it
    const exec = await executeAction(action, ComplexExecutor);

    let [createdGroup, user, message, contact] = await Promise.all([
      action.editedEnt(),
      userAction!.editedEnt(),
      messageAction!.editedEnt(),
      userAction!.contactAction!.builder.editedEnt(),
    ]);
    // 4 nodes changed:
    // * Group updated(shouldn't actually be)
    // * User created
    // * Message created
    // * Contact created
    // 7 edges added (assume all one-way):
    // 1 workspace member
    // 3 channel members (for the 3 auto-join channels)
    // 2 messages: 1 from message -> sender and one from message -> receiver
    // 1 user->contact (user -> self-contact)
    expect(operations.length).toBe(11);
    expect(createdGroup).toBeInstanceOf(Group);
    expect(user).toBeInstanceOf(User);
    expect(message).toBeInstanceOf(Message);

    expect(exec.resolveValue(userAction!.builder.placeholderID)).toStrictEqual(
      user,
    );
    expect(exec.resolveValue(action.builder.placeholderID)).toStrictEqual(
      createdGroup,
    );
    expect(
      exec.resolveValue(messageAction!.builder.placeholderID),
    ).toStrictEqual(message);

    QueryRecorder.validateQueryStructuresFromLogs(
      ml,
      [
        {
          tableName: "users",
          type: queryType.INSERT,
        },
        {
          tableName: "contacts",
          type: queryType.INSERT,
        },
        {
          tableName: "messages",
          type: queryType.INSERT,
        },
        {
          tableName: "groups",
          type: queryType.UPDATE,
        },

        {
          tableName: "channelMember_table",
          type: queryType.INSERT,
        },
        {
          tableName: "channelMember_table",
          type: queryType.INSERT,
        },
        {
          tableName: "channelMember_table",
          type: queryType.INSERT,
        },
        {
          tableName: "selfContact_table",
          type: queryType.INSERT,
        },
        {
          tableName: "senderToMessage_table",
          type: queryType.INSERT,
        },
        {
          tableName: "recipientToMessage_table",
          type: queryType.INSERT,
        },
        {
          tableName: "workspaceMember_table",
          type: queryType.INSERT,
        },
      ],
      true,
    );
    FakeLogger.verifyLogs(4);
    expect(FakeLogger.contains(`ent User created with id ${user?.id}`)).toBe(
      true,
    );
    expect(
      FakeLogger.contains(`ent Group created with id ${createdGroup?.id}`),
    ).toBe(true);
    expect(
      FakeLogger.contains(`ent Message created with id ${message?.id}`),
    ).toBe(true);
    expect(
      FakeLogger.contains(`ent Contact created with id ${contact?.id}`),
    ).toBe(true);
  });

  test("conditional changesets", async () => {
    const group = await createGroup();
    ml.clear();

    const action = new SimpleAction(
      new LoggedOutViewer(),
      new GroupSchema(),
      new Map(),
      WriteOperation.Edit,
      group,
    );

    const userAction = new UserAction(
      new LoggedOutViewer(),
      new Map([
        ["FirstName", "Jon"],
        ["LastName", "Snow"],
        ["EmailAddress", randomEmail()],
      ]),
      WriteOperation.Insert,
    );

    async function doNothing(): Promise<void> {}
    action.triggers = [
      {
        changeset: async (builder: SimpleBuilder<Group>) => {
          return await Promise.all([userAction.changeset(), doNothing()]);
        },
      },
    ];

    // this mostly confirms that things type and work
    await action.saveX();
    const [editedGroup, user] = await Promise.all([
      action.editedEnt(),
      userAction.editedEnt(),
    ]);
    expect(editedGroup).toBeInstanceOf(Group);
    expect(user).toBeInstanceOf(User);
  });

  test("async changeset that updates builder", async () => {
    const group = await createGroup();
    ml.clear();

    const action = new SimpleAction(
      new LoggedOutViewer(),
      new GroupSchema(),
      new Map(),
      WriteOperation.Edit,
      group,
    );

    async function fetchFoo(): Promise<void> {
      await new Promise((resolve, reject) => {
        setTimeout(() => resolve(null), 5);
      });
    }
    action.triggers = [
      {
        changeset: async (builder: SimpleBuilder<Group>) => {
          await fetchFoo();
          builder.fields.set("funField", "22");
        },
      },
    ];

    await action.saveX();
    const editedGroup = await action.editedEnt();
    expect(editedGroup).toBeInstanceOf(Group);
    expect(editedGroup?.data["fun_field"]).toBe("22");
  });

  test("nested siblings via bulk-action", async () => {
    const group = await createGroup();
    const inputs: { firstName: string; lastName: string }[] = [
      {
        firstName: "Arya",
        lastName: "Stark",
      },
      {
        firstName: "Robb",
        lastName: "Stark",
      },
      {
        firstName: "Sansa",
        lastName: "Stark",
      },
      {
        firstName: "Rickon",
        lastName: "Stark",
      },
      {
        firstName: "Bran",
        lastName: "Stark",
      },
    ];
    const accountAction = new SimpleAction(
      new LoggedOutViewer(),
      new AccountSchema(),
      new Map([]),
      WriteOperation.Insert,
    );

    const actions: SimpleAction<Ent>[] = inputs.map(
      (input) =>
        new UserAction(
          new LoggedOutViewer(),
          new Map<string, any>([
            ["FirstName", input.firstName],
            ["LastName", input.lastName],
            ["AccountID", accountAction.builder],
          ]),
          WriteOperation.Insert,
        ),
    );
    actions.push(accountAction);

    class GroupBuilder extends SimpleBuilder<Group> {
      constructor(
        viewer: Viewer,
        operation: WriteOperation,
        action: SimpleAction<Group>,
        existingEnt?: Group,
      ) {
        super(
          viewer,
          new GroupSchema(),
          new Map(),
          operation,
          existingEnt,
          action,
        );
      }
    }

    let action1 = actions[0];
    let action2 = actions[1];
    actions.push(
      new MessageAction(
        group.viewer,
        new Map<string, any>([
          ["sender", action1.builder],
          ["recipient", action2.builder],
          ["message", `${inputs[0].firstName} has joined!`],
          ["transient", true],
          ["expiresAt", new Date().setTime(new Date().getTime() + 86400)],
        ]),
        WriteOperation.Insert,
      ),
    );

    const action = BaseAction.bulkAction(group, GroupBuilder, ...actions);
    await action.saveX();

    const ents = (await Promise.all(
      actions.map((action) => action.editedEnt()),
    )) as User[];
    const users = ents.slice(0, inputs.length);
    expect(users.length).toBe(inputs.length);
    const account = ents[inputs.length];
    const message = ents[inputs.length + 1];
    expect(account).toBeInstanceOf(Account);
    expect(message).toBeInstanceOf(Message);

    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      const user = users[i];
      expect(user).not.toBeNull();
      if (!user) {
        fail("impossicant");
      }
      expect(user).toBeInstanceOf(User);

      expect(input.firstName).toBe(user.data.first_name);
      expect(input.lastName).toBe(user.data.last_name);
      expect(user.data.account_id).toBe(account?.id);
    }

    if (!message) {
      fail("impossicant");
    }

    expect(message["data"].sender).toBe(users[0]?.id);
    expect(message["data"].recipient).toBe(users[1]?.id);
  });
}
