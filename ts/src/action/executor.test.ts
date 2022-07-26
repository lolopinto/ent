import { Ent, ID, Viewer, Data, PrivacyPolicy } from "../core/base";
import { DataOperation, loadEdges, loadEnts, loadRows } from "../core/ent";
import * as clause from "../core/clause";
import { ObjectLoaderFactory } from "../core/loaders/object_loader";
import {
  Action,
  Builder,
  Changeset,
  Executor,
  WriteOperation,
  Trigger,
  Observer,
  TriggerReturn,
} from "../action/action";
import { executeOperations } from "../action/executor";
import { EdgeInputData } from "../action/orchestrator";

import { Dialect } from "../core/db";

import { Pool } from "pg";
import { QueryRecorder, queryType } from "../testutils/db_mock";
import {
  User,
  Group,
  Message,
  Contact,
  SimpleBuilder,
  BuilderSchema,
  SimpleAction,
  getTableName,
  getBuilderSchemaFromFields,
} from "../testutils/builder";
import { LoggedOutViewer, IDViewer } from "../core/viewer";
import {
  StringType,
  TimestampType,
  BooleanType,
  UUIDType,
} from "../schema/field";
import { JSONBType } from "../schema/json_field";
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
import * as action from "../action";

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
  "objectToChangelog",
  "changelogToParent",
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
  setLogLevels(["query", "error", "cache"]);
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
      AccountSchema,
      ContactSchema,
      GroupSchema,
      UserSchema,
      MessageSchema,
      GroupMembershipSchema,
      ChangelogSchema,
    ].map((s) => tables.push(getSchemaTable(s, Dialect.SQLite)));
    return tables;
  };

  setupSqlite(`sqlite:///executor-test.db`, getTables);
  commonTests();
});

jest.spyOn(action, "saveBuilder").mockImplementation(saveBuilder);
jest.spyOn(action, "saveBuilderX").mockImplementation(saveBuilderX);

async function saveBuilder<T extends Ent>(builder: Builder<T>): Promise<void> {
  const changeset = await builder.build();
  const executor = changeset.executor();
  operations = await executeOperations(executor, builder.viewer.context, true);
}

async function saveBuilderX<T extends Ent>(builder: Builder<T>): Promise<void> {
  return saveBuilder(builder);
}

async function executeAction<T extends Ent, E = any>(
  action: Action<T, Builder<T>>,
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

async function createUser(): Promise<User> {
  const id = QueryRecorder.newID();
  return new User(new IDViewer(id), { id });
}

const UserSchema = getBuilderSchemaFromFields(
  {
    FirstName: StringType(),
    LastName: StringType(),
    EmailAddress: StringType({ nullable: true }),
    AccountID: UUIDType({ nullable: true }),
  },
  User,
);

class Account implements Ent {
  id: ID;
  accountID: string = "";
  nodeType = "Account";
  getPrivacyPolicy(): PrivacyPolicy<this> {
    return AlwaysAllowPrivacyPolicy;
  }

  constructor(public viewer: Viewer, public data: Data) {
    this.id = data.id;
  }
}

const AccountSchema = getBuilderSchemaFromFields({}, Account);

const ContactSchema = getBuilderSchemaFromFields(
  {
    FirstName: StringType(),
    LastName: StringType(),
    UserID: StringType(),
  },
  Contact,
);

const GroupSchema = getBuilderSchemaFromFields(
  {
    name: StringType(),
    funField: StringType({ nullable: true }),
  },
  Group,
);

class GroupMembership implements Ent {
  id: ID;
  nodeType = "GroupMembership";
  getPrivacyPolicy(): PrivacyPolicy<this> {
    return AlwaysAllowPrivacyPolicy;
  }

  constructor(public viewer: Viewer, public data: Data) {
    this.id = data.id;
  }
}

const GroupMembershipSchema = getBuilderSchemaFromFields(
  {
    ownerID: UUIDType(),
    addedBy: UUIDType(),
    notificationsEnabled: BooleanType(),
  },
  GroupMembership,
);

class Changelog implements Ent {
  id: ID;
  nodeType = "Changelog";
  getPrivacyPolicy(): PrivacyPolicy<this> {
    return AlwaysAllowPrivacyPolicy;
  }

  constructor(public viewer: Viewer, public data: Data) {
    this.id = data.id;
  }
}

const ChangelogSchema = getBuilderSchemaFromFields(
  {
    parentID: UUIDType({ polymorphic: true }),
    log: JSONBType(),
  },
  Changelog,
);

const MessageSchema = getBuilderSchemaFromFields(
  {
    // TODO both id fields
    sender: StringType(), // can't use from
    recipient: StringType(), // can't use to in sqlite
    message: StringType(),
    transient: BooleanType({ nullable: true }),
    expiresAt: TimestampType({ nullable: true }),
  },
  Message,
);

class MessageAction extends SimpleAction<Message> {
  constructor(
    viewer: Viewer,
    fields: Map<string, any>,
    operation: WriteOperation,
    existingEnt: Message | null,
  ) {
    super(viewer, MessageSchema, fields, operation, existingEnt);
  }

  getTriggers(): Trigger<Message, SimpleBuilder<Message, Message | null>>[] {
    return [
      {
        changeset: (builder, _input): void => {
          let sender = builder.fields.get("sender");
          let recipient = builder.fields.get("recipient");

          builder.orchestrator.addInboundEdge(
            sender,
            "senderToMessage",
            "user",
          );
          builder.orchestrator.addInboundEdge(
            recipient,
            "recipientToMessage",
            "user",
          );
        },
      },
    ];
  }

  getObservers(): Observer<Message, SimpleBuilder<Message>>[] {
    return [new EntCreationObserver<Message>()];
  }
}

class UserAction extends SimpleAction<User> {
  contactAction: SimpleAction<Contact> | undefined;

  constructor(
    viewer: Viewer,
    fields: Map<string, any>,
    operation: WriteOperation,
    existingEnt: User | null,
  ) {
    super(viewer, UserSchema, fields, operation, existingEnt);
  }

  getTriggers(): Trigger<User, SimpleBuilder<User>>[] {
    return [
      {
        changeset: (builder): Promise<Changeset> => {
          let firstName = builder.fields.get("FirstName");
          let lastName = builder.fields.get("LastName");
          this.contactAction = new SimpleAction(
            builder.viewer,
            ContactSchema,
            new Map([
              ["FirstName", firstName],
              ["LastName", lastName],
              ["UserID", builder],
            ]),
            WriteOperation.Insert,
            null,
          );

          this.contactAction.getObservers = () => [
            new EntCreationObserver<Contact>(),
          ];

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

  getObservers(): Observer<User, SimpleBuilder<User>>[] {
    return [new EntCreationObserver<User>()];
  }
}

type getMembershipFunction = (
  viewer: Viewer,
  edge: EdgeInputData,
) => SimpleAction<Ent>;

class GroupMembershipTrigger implements Trigger<Group, SimpleBuilder<Group>> {
  constructor(private getter: getMembershipFunction) {}
  changeset(builder: SimpleBuilder<Group>, input: Data): TriggerReturn {
    const inputEdges = builder.orchestrator.getInputEdges(
      "workspaceMember",
      WriteOperation.Insert,
    );
    const changesets: TriggerReturn = [];
    for (const edge of inputEdges) {
      // we're going to simplify and assume it doesn't currently exist
      const memberAction = this.getter(builder.viewer, edge);
      // store the membership edge in data field of member edge
      builder.orchestrator.addOutboundEdge(edge.id, "workspaceMember", "User", {
        data: memberAction.builder,
      });
      changesets.push(memberAction.changeset());
    }
    return Promise.all(changesets);
  }
}

class EditGroupAction extends SimpleAction<Group> {
  constructor(
    public viewer: Viewer,
    schema: BuilderSchema<Group>,
    fields: Map<string, any>,
    operation: WriteOperation = WriteOperation.Insert,
    existingEnt: Group,
    private getter: getMembershipFunction,
  ) {
    super(viewer, schema, fields, operation, existingEnt);
  }
  getTriggers = () => [new GroupMembershipTrigger(this.getter)];
}

function randomEmail(): string {
  const rand = Math.random().toString(16).substring(2);

  return `test+${rand}@email.com`;
}

async function verifyGroupMembers(group: Group, members: User[]) {
  const memberEdges = await loadEdges({
    edgeType: "workspaceMember",
    id1: group.id,
  });
  const memberIDs = members.map((ent) => ent.id);
  expect(memberIDs.sort()).toEqual(memberEdges.map((edge) => edge.id2).sort());
  // @ts-ignore
  const membershipids: ID[] = memberEdges
    .map((edge) => edge.data)
    .filter((str) => str !== null && str !== undefined);
  return membershipids;
}

async function loadMemberships(viewer: Viewer, membershipids: ID[]) {
  const tableName = getTableName(GroupMembershipSchema);
  const ents = await loadEnts(
    viewer,
    {
      tableName,
      ent: GroupMembership,
      fields: ["id", "owner_id", "added_by", "notifications_enabled"],
      loaderFactory: new ObjectLoaderFactory({
        tableName,
        fields: ["id", "owner_id", "added_by", "notifications_enabled"],
        key: "id",
      }),
    },
    ...membershipids,
  );
  return Array.from(ents.values());
}

async function loadChangelogs(viewer: Viewer, clids: ID[]) {
  const ents = await loadEnts(
    viewer,
    {
      tableName: "changelogs",
      ent: Changelog,
      fields: ["id", "parent_id", "log"],
      loaderFactory: new ObjectLoaderFactory({
        tableName: "changelogs",
        fields: ["id", "parent_id", "log"],
        key: "id",
      }),
    },
    ...clids,
  );
  return Array.from(ents.values());
}

async function verifyChangelogFromMeberships(
  user: User,
  memberships: GroupMembership[],
) {
  await Promise.all(
    memberships.map(async (membership) => {
      const edges = await loadEdges({
        edgeType: "objectToChangelog",
        id1: membership.id,
      });
      expect(edges.length).toBe(1);
      const clIDs = edges.map((edge) => edge.id2);
      const cls = await loadChangelogs(user.viewer, clIDs);
      expect(cls.length).toBe(1);
      const cl: Changelog = cls[0];
      expect(edges[0].id2).toBe(cl.id);
      expect(JSON.parse(cl.data.log)).toMatchObject({
        // also has ownerID...
        addedBy: user.id,
        notificationsEnabled: true,
      });
    }),
  );
}

function commonTests() {
  test("empty", async () => {
    const action = new SimpleAction(
      new LoggedOutViewer(),
      UserSchema,
      new Map([
        ["FirstName", "Jon"],
        ["LastName", "Snow"],
      ]),
      WriteOperation.Insert,
      null,
    );
    const user = await action.saveX();
    expect(operations.length).toBe(1);

    // insert query
    QueryRecorder.validateQueryStructuresFromLogs(
      ml,
      [
        {
          tableName: "users",
          type: queryType.INSERT,
        },
      ],
      // skipping assoc_edge_config load and potentially sqlite select *
      true,
    );
    ml.clear();

    const viewer = new LoggedOutViewer();

    const builder = new SimpleBuilder(
      viewer,
      UserSchema,
      new Map(),
      WriteOperation.Edit,
      user,
    );

    await builder.saveX();
    let ent = await builder.editedEntX();
    expect(ent).toBeDefined();
    expect(operations.length).toBe(1);
    // there's an operation but no query.
    QueryRecorder.validateQueryStructuresFromLogs(
      ml,
      [],
      // skipping assoc_edge_config load and potentially sqlite select *
      true,
    );
  });

  test("simple-one-op-created-ent", async () => {
    const action = new SimpleAction(
      new LoggedOutViewer(),
      UserSchema,
      new Map([
        ["FirstName", "Jon"],
        ["LastName", "Snow"],
      ]),
      WriteOperation.Insert,
      null,
    );

    const exec = await executeAction(action, ListBasedExecutor);

    const ent = await action.editedEntX();
    expect(exec.resolveValue(action.builder.placeholderID)).toStrictEqual(ent);
    expect(exec.resolveValue(ent.id)).toBe(null);

    expect(operations.length).toBe(1);

    // data saved. confirm that default values on create set
    const data = ent.data;
    expect(data.id).toBe(ent.id);
    expect(data.created_at).toBeDefined();
    expect(data.updated_at).toBeDefined();
    expect(data.first_name).toBe("Jon");
    expect(data.last_name).toBe("Snow");

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

  test("simple-one-op-no-edited-ent", async () => {
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
      UserSchema,
      new Map(),
      WriteOperation.Edit,
      user,
    );
    const id2 = QueryRecorder.newID();

    action.builder.orchestrator.addOutboundEdge(id2, "fake_edge", "user");

    const exec = await executeAction(action, ListBasedExecutor);
    let ent = await action.editedEntX();
    expect(exec.resolveValue(action.builder.placeholderID)).toStrictEqual(ent);

    // 2 operations. Edit NodeOperation still created because it's needed to resolve placeholder
    // however, no writes done. see query below

    expect(operations.length).toBe(2);
    QueryRecorder.validateQueryStructuresFromLogs(
      ml,
      [
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
      UserSchema,
      new Map([
        ["FirstName", "Jon"],
        ["LastName", "Snow"],
      ]),
      WriteOperation.Insert,
      null,
    );
    let firstName = userBuilder.fields.get("FirstName");
    let lastName = userBuilder.fields.get("LastName");
    let contactAction = new SimpleAction(
      userBuilder.viewer,
      ContactSchema,
      new Map([
        ["FirstName", firstName],
        ["LastName", lastName],
        ["UserID", userBuilder],
      ]),
      WriteOperation.Insert,
      null,
    );

    try {
      // list based executor because dependencies but no changesets
      // can't actually run this on its own but that's expected
      await executeAction(contactAction, ListBasedExecutor);
      throw new Error("should not have gotten here");
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
      null,
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
      GroupSchema,
      new Map(),
      WriteOperation.Edit,
      group,
    );

    action.getTriggers = () => [
      {
        changeset: async (
          builder: SimpleBuilder<Group>,
        ): Promise<Changeset[]> => {
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
            null,
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
            null,
          );

          return await Promise.all([
            userAction.changeset(),
            messageAction.changeset(),
          ]);
        },
      },
    ];
    action.getObservers = () => [new EntCreationObserver<Group>()];

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

  test("nested edge id2. no field dependencies", async () => {
    class CreateChangelogAction extends SimpleAction<Changelog> {}

    class CreateMembershipAction extends SimpleAction<GroupMembership> {
      getTriggers = () => [
        {
          async changeset(builder: SimpleBuilder<GroupMembership>, input) {
            const clAction = new CreateChangelogAction(
              builder.viewer,
              ChangelogSchema,
              new Map([
                // no dependency on fields. all new
                ["parentID", QueryRecorder.newID()],
                ["parentType", "GroupMembership"],
                ["log", input],
              ]),
              WriteOperation.Insert,
              null,
            );
            builder.orchestrator.addOutboundEdge(
              clAction.builder,
              "objectToChangelog",
              "Changelog",
            );
            return clAction.changeset();
          },
        },
      ];
    }

    const group = await createGroup();
    const user = await createUser();
    const members = await Promise.all([1, 2, 3].map(createUser));

    const groupAction = new EditGroupAction(
      new IDViewer(user.id),
      GroupSchema,
      new Map(),
      WriteOperation.Edit,
      group,
      (viewer, edge) => {
        return new CreateMembershipAction(
          viewer,
          GroupMembershipSchema,
          new Map<string, any>([
            ["ownerID", edge.id],
            ["addedBy", viewer.viewerID!],
            ["notificationsEnabled", true],
          ]),
          WriteOperation.Insert,
          null,
        );
      },
    );
    members.map((member) =>
      groupAction.builder.orchestrator.addOutboundEdge(
        member.id,
        "workspaceMember",
        "User",
      ),
    );
    const editedGroup = await groupAction.saveX();
    const membershipids = await verifyGroupMembers(editedGroup, members);
    expect(membershipids.length).toBe(members.length);
    const memberships = await loadMemberships(user.viewer, membershipids);
    expect(membershipids.length).toBe(memberships.length);

    await verifyChangelogFromMeberships(user, memberships);
  });

  test("nested edge id1. no field dependencies", async () => {
    class CreateChangelogAction extends SimpleAction<Changelog> {}

    class CreateMembershipAction extends SimpleAction<GroupMembership> {
      getTriggers = () => [
        {
          async changeset(builder: SimpleBuilder<GroupMembership>, input) {
            const clAction = new CreateChangelogAction(
              builder.viewer,
              ChangelogSchema,
              new Map([
                // no builder field
                ["parentID", QueryRecorder.newID()],
                ["parentType", "GroupMembership"],
                ["log", input],
              ]),
              WriteOperation.Insert,
              null,
            );
            builder.orchestrator.addInboundEdge(
              clAction.builder,
              "changelogToParent",
              "Changelog",
            );
            return clAction.changeset();
          },
        },
      ];
    }

    const group = await createGroup();
    const user = await createUser();
    const members = await Promise.all([1, 2, 3].map(createUser));

    const groupAction = new EditGroupAction(
      new IDViewer(user.id),
      GroupSchema,
      new Map(),
      WriteOperation.Edit,
      group,
      (viewer, edge) => {
        return new CreateMembershipAction(
          viewer,
          GroupMembershipSchema,
          new Map<string, any>([
            ["ownerID", edge.id],
            ["addedBy", viewer.viewerID!],
            ["notificationsEnabled", true],
          ]),
          WriteOperation.Insert,
          null,
        );
      },
    );
    members.map((member) =>
      groupAction.builder.orchestrator.addOutboundEdge(
        member.id,
        "workspaceMember",
        "User",
      ),
    );
    const editedGroup = await groupAction.saveX();
    const membershipids = await verifyGroupMembers(editedGroup, members);
    expect(membershipids.length).toBe(members.length);
    const memberships = await loadMemberships(user.viewer, membershipids);
    expect(membershipids.length).toBe(memberships.length);

    // weird data model for test so we have to load it via a table scan. good old query
    await Promise.all(
      Array.from(memberships.values()).map(async (membership) => {
        const edges = await loadRows({
          clause: clause.And(
            clause.Eq("edge_type", "changelogToParent"),
            clause.Eq("id2", membership.id),
          ),
          fields: ["id1", "id2", "edge_type", "data"],
          tableName: "changelogToParent_table",
        });
        expect(edges.length).toBe(1);
        const clIDs = edges.map((edge) => edge.id1);
        const cls = await loadChangelogs(user.viewer, clIDs);
        expect(cls.length).toBe(1);
        const cl: Changelog = cls[0];
        expect(edges[0].id1).toBe(cl.id);
        expect(JSON.parse(cl.data.log)).toMatchObject({
          addedBy: user.id,
          notificationsEnabled: true,
        });
      }),
    );
  });

  test("nested with list + node + edge deps", async () => {
    class CreateMembershipAction extends SimpleAction<GroupMembership> {
      getTriggers = () => [
        {
          async changeset(builder: SimpleBuilder<GroupMembership>, input) {
            const clAction = new CreateChangelogAction(
              builder.viewer,
              ChangelogSchema,
              new Map([
                ["parentID", builder],
                ["parentType", "GroupMembership"],
                ["log", input],
              ]),
              WriteOperation.Insert,
              null,
            );
            builder.orchestrator.addOutboundEdge(
              clAction.builder,
              "objectToChangelog",
              "Changelog",
            );
            return clAction.changeset();
          },
        },
      ];
    }

    class CreateChangelogAction extends SimpleAction<Changelog> {}

    const group = await createGroup();
    const user = await createUser();
    const members = await Promise.all([1, 2, 3].map(createUser));

    const groupAction = new EditGroupAction(
      new IDViewer(user.id),
      GroupSchema,
      new Map(),
      WriteOperation.Edit,
      group,
      (viewer, edge) => {
        return new CreateMembershipAction(
          viewer,
          GroupMembershipSchema,
          new Map<string, any>([
            ["ownerID", edge.id],
            ["addedBy", viewer.viewerID!],
            ["notificationsEnabled", true],
          ]),
          WriteOperation.Insert,
          null,
        );
      },
    );
    members.map((member) =>
      groupAction.builder.orchestrator.addOutboundEdge(
        member.id,
        "workspaceMember",
        "User",
      ),
    );

    const editedGroup = await groupAction.saveX();
    const membershipids = await verifyGroupMembers(editedGroup, members);
    const memberships = await loadMemberships(user.viewer, membershipids);

    await verifyChangelogFromMeberships(user, memberships);

    expect(membershipids.length).toBe(memberships.length);
  });

  test("conditional changesets", async () => {
    const group = await createGroup();
    ml.clear();

    const action = new SimpleAction(
      new LoggedOutViewer(),
      GroupSchema,
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
      null,
    );

    async function doNothing(): Promise<void> {}
    action.getTriggers = () => [
      {
        changeset: async () => {
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
      GroupSchema,
      new Map(),
      WriteOperation.Edit,
      group,
    );

    async function fetchFoo(): Promise<void> {
      await new Promise((resolve, reject) => {
        setTimeout(() => resolve(null), 5);
      });
    }
    action.getTriggers = () => [
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
      AccountSchema,
      new Map([]),
      WriteOperation.Insert,
      null,
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
          null,
        ),
    );
    actions.push(accountAction);

    type MaybeNull<T extends Ent> = T | null;
    type TMaybleNullableEnt<T extends Ent> = T | MaybeNull<T>;

    class GroupBuilder<
      TExistingEnt extends TMaybleNullableEnt<Group> = MaybeNull<Group>,
    > extends SimpleBuilder<Group, TExistingEnt> {
      constructor(
        viewer: Viewer,
        operation: WriteOperation,
        action: SimpleAction<Group, TExistingEnt>,
        existingEnt: TExistingEnt,
      ) {
        super(viewer, GroupSchema, new Map(), operation, existingEnt, action);
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
        null,
      ),
    );

    // @ts-ignore why??
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
        throw new Error("impossicant");
      }
      expect(user).toBeInstanceOf(User);

      expect(input.firstName).toBe(user.data.first_name);
      expect(input.lastName).toBe(user.data.last_name);
      expect(user.data.account_id).toBe(account?.id);
    }

    if (!message) {
      throw new Error("impossicant");
    }

    expect(message["data"].sender).toBe(users[0]?.id);
    expect(message["data"].recipient).toBe(users[1]?.id);
  });
}
