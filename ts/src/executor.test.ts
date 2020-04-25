import { Ent, DataOperation, Viewer } from "./ent";
import { Builder, Changeset, Executor, WriteOperation } from "./action";
import * as action from "./action";
import * as ent from "./ent";
import { snakeCase } from "snake-case";

import DB from "./db";

import { Pool } from "pg";
import { QueryRecorder, queryType } from "./testutils/db_mock";
import {
  User,
  Group,
  Message,
  FakeBuilder,
  Contact,
  SimpleBuilder,
  SimpleAction,
} from "./testutils/builder";
import { LoggedOutViewer } from "./viewer";
import { BaseEntSchema, Field } from "./schema";
import { StringType, TimeType, BooleanType } from "./field";
import { ListBasedExecutor, ComplexExecutor } from "./executor";
import * as query from "./query";
import { IDViewer } from "./testutils/id_viewer";

jest.mock("pg");
QueryRecorder.mockPool(Pool);

jest
  .spyOn(ent, "loadEdgeDatas")
  .mockImplementation(QueryRecorder.mockImplOfLoadEdgeDatas);

let operations: DataOperation[] = [];

beforeEach(() => {
  // can't mock loadEdgeData because it's being called from within the ent module so have to do this instead
  // this is getting too complicated...

  // TODO can change loadEdgeDatas to do this depending on values[0]
  QueryRecorder.mockResult({
    tableName: "assoc_edge_config",
    clause: query.Eq("edge_type", "fake_edge"),
    row: (values: any[]) => {
      let edgeType = values[0];
      return {
        edge_table: snakeCase(`${edgeType}_table`),
        symmetric_edge: false,
        inverse_edge_type: null,
        edge_type: edgeType,
        edge_name: "name",
      };
    },
  });
});

afterEach(() => {
  QueryRecorder.clear();
  operations = [];
});

jest.spyOn(action, "saveBuilder").mockImplementation(saveBuilder);

async function saveBuilder<T extends Ent>(builder: Builder<T>): Promise<void> {
  const changeset = await builder.build();
  const executor = changeset.executor();
  await executeOperations(executor);
}

async function executeOperations<T extends Ent>(
  executor: Executor<T>,
): Promise<void> {
  const client = await DB.getInstance().getNewClient();

  try {
    await client.query("BEGIN");
    for (const operation of executor) {
      // resolve any placeholders before writes
      operations.push(operation);
      if (operation.resolve) {
        operation.resolve(executor);
      }

      await operation.performWrite(client);
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    // rethrow
    throw e;
  }
}

async function executor<T extends Ent>(
  builder: Builder<T>,
): Promise<Executor<T>> {
  const changeset = await builder.build();
  return changeset.executor();
}

class UserSchema extends BaseEntSchema {
  fields: Field[] = [
    StringType({ name: "FirstName" }),
    StringType({ name: "LastName" }),
    StringType({ name: "EmailAddress", nullable: true }),
  ];
  ent = User;
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
  fields: Field[] = [];
  ent = Group;
}

class MessageSchema extends BaseEntSchema {
  fields: Field[] = [
    // TODO both id fields
    StringType({ name: "from" }),
    StringType({ name: "to" }),
    StringType({ name: "message" }),
    BooleanType({ name: "transient", nullable: true }),
    TimeType({ name: "expiresAt", nullable: true }),
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

  triggers: action.Trigger<Message>[] = [
    {
      changeset: (builder: SimpleBuilder<Message>): void => {
        let from = builder.fields.get("from");
        let to = builder.fields.get("to");

        builder.orchestrator.addInboundEdge(from, "senderToMessage", "user");
        builder.orchestrator.addInboundEdge(to, "recipientToMessage", "user");
      },
    },
  ];
}

class UserAction extends SimpleAction<User> {
  contactAction: SimpleAction<Contact>;

  constructor(
    viewer: Viewer,
    fields: Map<string, any>,
    operation: WriteOperation,
    existingEnt?: User,
  ) {
    super(viewer, new UserSchema(), fields, operation, existingEnt);
  }

  triggers: action.Trigger<User>[] = [
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
        builder.orchestrator.addOutboundEdge(
          this.contactAction.builder,
          "selfContact",
          "contact",
        );
        return this.contactAction.changeset();
      },
    },
  ];
}

function randomEmail(): string {
  const rand = Math.random()
    .toString(16)
    .substring(2);

  return `test+${rand}@email.com`;
}

test("empty", async () => {
  const builder = new FakeBuilder(new Map(), WriteOperation.Insert, User);

  let ent = await builder.save();
  expect(ent).toBe(null);
  expect(operations.length).toBe(0);
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

  const exec = await executor(action.builder);
  expect(exec).toBeInstanceOf(ListBasedExecutor);
  await executeOperations(exec);

  let ent = await action.editedEnt();
  expect(ent).not.toBe(null);
  expect(exec.resolveValue(action.builder.placeholderID)).toStrictEqual(ent);
  expect(exec.resolveValue(ent?.id)).toBe(null);

  expect(operations.length).toBe(1);
  QueryRecorder.validateQueryStructuresInTx([
    {
      tableName: "User",
      type: queryType.INSERT,
    },
  ]);
});

test("simple-one-op-no-created-ent", async () => {
  let id = QueryRecorder.newID();
  const viewer = new IDViewer(id);
  const user = new User(viewer, id, {});
  const action = new SimpleAction(
    viewer,
    new UserSchema(),
    new Map(),
    WriteOperation.Edit,
    user,
  );
  const id2 = QueryRecorder.newID();

  action.builder.orchestrator.addOutboundEdge(id2, "fakeEdge", "user");

  const exec = await executor(action.builder);
  await executeOperations(exec);
  let ent = await action.editedEnt();
  expect(ent).not.toBe(null);
  expect(exec.resolveValue(action.builder.placeholderID)).toStrictEqual(ent);

  expect(operations.length).toBe(2);
  QueryRecorder.validateQueryStructuresInTx([
    {
      // TODO this shouldn't be here...
      tableName: "User",
      type: queryType.UPDATE,
    },
    {
      tableName: "fake_edge_table",
      type: queryType.INSERT,
    },
  ]);
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

  // list based executor because dependencies but no changesets
  const exec = await executor(contactAction.builder);
  expect(exec).toBeInstanceOf(ListBasedExecutor);

  try {
    // can't actually run this on its own but that's expected
    await executeOperations(exec);
    fail("should not have gotten here");
  } catch (e) {
    expect(e.message).toBe(
      `couldn't resolve field user_id with value ${userBuilder.placeholderID}`,
    );
    expect(operations.length).toBe(1);
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
  const exec = await executor(action.builder);
  expect(exec).toBeInstanceOf(ComplexExecutor);

  await executeOperations(exec);
  let [user, contact] = await Promise.all([
    action.editedEnt(),
    action.contactAction.editedEnt(),
  ]);
  expect(operations.length).toBe(3);
  expect(user).toBeInstanceOf(User);
  expect(contact).toBeInstanceOf(Contact);

  expect(
    exec.resolveValue(action.contactAction.builder.placeholderID),
  ).toStrictEqual(contact);
  expect(exec.resolveValue(action.builder.placeholderID)).toStrictEqual(user);

  QueryRecorder.validateQueryStructuresInTx([
    {
      tableName: "User",
      type: queryType.INSERT,
    },
    {
      tableName: "Contact",
      type: queryType.INSERT,
    },
    {
      tableName: "self_contact_table",
      type: queryType.INSERT,
    },
  ]);
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
    return new User(viewer, QueryRecorder.newID(), {});
  }
  const group = new Group(new LoggedOutViewer(), QueryRecorder.newID(), {});

  let userAction: SimpleAction<User>;
  let messageAction: SimpleAction<Message>;

  const action = new SimpleAction(
    new LoggedOutViewer(),
    new GroupSchema(),
    new Map(),
    WriteOperation.Edit,
    group,
  );
  // this would ordinarily be built into the action...
  action.builder.orchestrator.addInboundEdge(
    group.id,
    "workspaceMember",
    "user",
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
          // for extra credit make this
          builder.orchestrator.addOutboundEdge(
            channel.id,
            "channelMember",
            "Channel",
          );
        }

        messageAction = new MessageAction(
          builder.viewer,
          new Map<string, any>([
            ["from", userAction.builder],
            ["to", invitee.id],
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

  // expect ComplexExecutor because of complexity of what we have here
  // we have a Group action which has nested things in it
  const exec = await executor(action.builder);
  expect(exec).toBeInstanceOf(ComplexExecutor);

  await executeOperations(exec);
  let [createdGroup, user, message] = await Promise.all([
    action.editedEnt(),
    userAction!.editedEnt(),
    messageAction!.editedEnt(),
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
  expect(exec.resolveValue(messageAction!.builder.placeholderID)).toStrictEqual(
    message,
  );

  QueryRecorder.validateQueryStructuresInTx([
    {
      tableName: "Group",
      type: queryType.UPDATE,
    },
    {
      tableName: "User",
      type: queryType.INSERT,
    },
    {
      tableName: "Contact",
      type: queryType.INSERT,
    },
    {
      tableName: "Message",
      type: queryType.INSERT,
    },
    {
      tableName: "workspace_member_table",
      type: queryType.INSERT,
    },
    {
      tableName: "channel_member_table",
      type: queryType.INSERT,
    },
    {
      tableName: "channel_member_table",
      type: queryType.INSERT,
    },
    {
      tableName: "channel_member_table",
      type: queryType.INSERT,
    },
    {
      tableName: "self_contact_table",
      type: queryType.INSERT,
    },
    {
      tableName: "sender_to_message_table",
      type: queryType.INSERT,
    },
    {
      tableName: "recipient_to_message_table",
      type: queryType.INSERT,
    },
  ]);
});
