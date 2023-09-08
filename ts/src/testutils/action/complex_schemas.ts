import { Ent, ID, Viewer, Data } from "../../core/base";
import { loadEdges, loadEnts } from "../../core/ent";
import { DataOperation } from "../../action/operations";
import { ObjectLoaderFactory } from "../../core/loaders/object_loader";
import {
  Action,
  Builder,
  Changeset,
  Executor,
  WriteOperation,
  Trigger,
  Observer,
  TriggerReturn,
} from "../../action/action";
import { executeOperations } from "../../action/executor";
import { EdgeInputData } from "../../action/orchestrator";
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
  BaseEnt,
} from "../../testutils/builder";
import { LoggedOutViewer, IDViewer } from "../../core/viewer";
import {
  StringType,
  TimestampType,
  BooleanType,
  UUIDType,
  FloatType,
} from "../../schema/field";
import { JSONBType } from "../../schema/json_field";
import { FakeLogger, EntCreationObserver } from "../../testutils/fake_log";
import { createRowForTest } from "../../testutils/write";
import { AlwaysAllowPrivacyPolicy } from "../../core/privacy";
import { MockLogs } from "../../testutils/mock_log";
import { setLogLevels } from "../../core/logger";
import * as action from "../../action";
import { convertJSON } from "../../core/convert";
import { v4 } from "uuid";
import {
  assoc_edge_config_table,
  assoc_edge_table,
  getSchemaTable,
  Table,
} from "../db/temp_db";
import { Dialect } from "../../core/db";
import { ConstraintType } from "../../schema";

const ml = new MockLogs();
let operations: DataOperation<any, Viewer>[] = [];

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

export function setupTest() {
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
    FakeLogger.clear();
    operations = [];
  });
}

export function getML() {
  return ml;
}

export function getOperations() {
  return operations;
}

export const UserSchema = getBuilderSchemaFromFields(
  {
    FirstName: StringType(),
    LastName: StringType(),
    EmailAddress: StringType({ nullable: true }),
    AccountID: UUIDType({ nullable: true }),
  },
  User,
);

export class UserWithBalance extends User {}

export const UserBalanceSchema = getBuilderSchemaFromFields(
  {
    first_name: StringType(),
    last_name: StringType(),
    email_address: StringType({ nullable: true }),
    balance: FloatType(),
  },
  UserWithBalance,
);

export class UserWithBalanceWithCheck extends UserWithBalance {}

export const UserBalanceWithCheckSchema = getBuilderSchemaFromFields(
  {
    first_name: StringType(),
    last_name: StringType(),
    email_address: StringType({ nullable: true }),
    balance: FloatType(),
  },
  UserWithBalanceWithCheck,
  {
    constraints: [
      {
        type: ConstraintType.Check,
        name: "positive_balance",
        columns: ["balance"],
        condition: "balance >= 0",
      },
    ],
  },
);

export class Account extends BaseEnt {
  accountID: string = "";
  nodeType = "Account";
}

export const AccountSchema = getBuilderSchemaFromFields({}, Account);

export const ContactSchema = getBuilderSchemaFromFields(
  {
    FirstName: StringType(),
    LastName: StringType(),
    UserID: StringType(),
  },
  Contact,
);

export const GroupSchema = getBuilderSchemaFromFields(
  {
    name: StringType(),
    funField: StringType({ nullable: true }),
  },
  Group,
);

export class GroupMembership extends BaseEnt {
  nodeType = "GroupMembership";
}

export const GroupMembershipSchema = getBuilderSchemaFromFields(
  {
    ownerID: UUIDType(),
    addedBy: UUIDType(),
    notificationsEnabled: BooleanType(),
  },
  GroupMembership,
);

export class Changelog extends BaseEnt {
  nodeType = "Changelog";
}

export const ChangelogSchema = getBuilderSchemaFromFields(
  {
    parentID: UUIDType({ polymorphic: true }),
    log: JSONBType(),
  },
  Changelog,
);

export const MessageSchema = getBuilderSchemaFromFields(
  {
    // TODO both id fields
    sender: StringType({
      index: true,
    }), // can't use from
    recipient: StringType(), // can't use to in sqlite
    message: StringType(),
    transient: BooleanType({ nullable: true }),
    expiresAt: TimestampType({ nullable: true }),
    delivered: BooleanType({ defaultValueOnCreate: () => false }),
  },
  Message,
);

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

export async function executeAction<T extends Ent, E = any>(
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

export async function createGroup() {
  let groupID = v4();
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

export async function createUser(): Promise<User> {
  const id = v4();
  return new User(new IDViewer(id), { id });
}

export class MessageAction extends SimpleAction<Message> {
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
          if (sender) {
            builder.orchestrator.addInboundEdge(
              sender,
              "senderToMessage",
              "user",
            );
          }
          if (recipient) {
            builder.orchestrator.addInboundEdge(
              recipient,
              "recipientToMessage",
              "user",
            );
          }
        },
      },
    ];
  }

  getObservers(): Observer<Message, SimpleBuilder<Message>>[] {
    return [new EntCreationObserver<Message>()];
  }
}

export class UserAction extends SimpleAction<User> {
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
  edge: EdgeInputData<Ent,Viewer>,
) => SimpleAction<Ent>;

export class GroupMembershipTrigger
  implements Trigger<Group, SimpleBuilder<Group>>
{
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

export class EditGroupAction extends SimpleAction<Group> {
  constructor(
    public viewer: Viewer,
    schema: BuilderSchema<Group>,
    fields: Map<string, any>,
    existingEnt: Group,
    private getter: getMembershipFunction,
  ) {
    super(viewer, schema, fields, WriteOperation.Edit, existingEnt);
  }
  getTriggers = () => [new GroupMembershipTrigger(this.getter)];
}

export async function verifyGroupMembers(group: Group, members: User[]) {
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

export async function loadMemberships(viewer: Viewer, membershipids: ID[]) {
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

export async function loadChangelogs(viewer: Viewer, clids: ID[]) {
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

export async function verifyChangelogFromMeberships(
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
      expect(convertJSON(cl.data.log)).toMatchObject({
        // also has ownerID...
        addedBy: user.id,
        notificationsEnabled: true,
      });
    }),
  );
}

export class GroupMemberOf extends BaseEnt {
  nodeType = "GroupMemberOf";
}

export const GroupMemberOfSchema = getBuilderSchemaFromFields(
  {
    userID: UUIDType({ index: true }),
    addedBy: UUIDType(),
    groupID: UUIDType(),
    notificationsEnabled: BooleanType(),
  },
  GroupMemberOf,
);

export const getTables = () => {
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
    GroupMemberOfSchema,
    UserBalanceSchema,
    UserBalanceWithCheckSchema,
  ].map((s) => tables.push(getSchemaTable(s, Dialect.SQLite)));
  return tables;
};
