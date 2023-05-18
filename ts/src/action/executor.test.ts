import { Viewer } from "../core/base";
import { loadRows } from "../core/ent";
import * as clause from "../core/clause";
import { Changeset, WriteOperation } from "../action/action";

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

import { ListBasedExecutor, ComplexExecutor } from "./executor";
import { FakeLogger, EntCreationObserver } from "../testutils/fake_log";
import { createRowForTest } from "../testutils/write";
import { setupPostgres, setupSqlite } from "../testutils/db/temp_db";
import { convertJSON } from "../core/convert";
import { v4 } from "uuid";
import {
  Changelog,
  ChangelogSchema,
  ContactSchema,
  createGroup,
  createUser,
  EditGroupAction,
  executeAction,
  getML,
  getOperations,
  getTables,
  GroupMembership,
  GroupMembershipSchema,
  GroupSchema,
  loadChangelogs,
  loadMemberships,
  MessageAction,
  setupTest,
  UserAction,
  UserSchema,
  verifyChangelogFromMeberships,
  verifyGroupMembers,
} from "../testutils/action/complex_schemas";

setupTest();
const ml = getML();

function randomEmail(): string {
  const rand = Math.random().toString(16).substring(2);

  return `test+${rand}@email.com`;
}

describe("postgres", () => {
  setupPostgres(getTables);
  commonTests();
});

describe("sqlite", () => {
  setupSqlite(`sqlite:///executor-test.db`, getTables);
  commonTests();
});

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

    expect(getOperations().length).toBe(1);

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
      { skipSelect: true },
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
    expect(getOperations().length).toBe(1);

    // there's an operation but no query.
    QueryRecorder.validateQueryStructuresFromLogs(
      ml,
      [],
      // skipping assoc_edge_config load and potentially sqlite select *
      { skipSelect: true },
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

    expect(getOperations().length).toBe(1);

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
      { skipSelect: true },
    );
  });

  test("simple-one-op-no-edited-ent", async () => {
    let id = v4();
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
    const id2 = v4();

    action.builder.orchestrator.addOutboundEdge(id2, "fake_edge", "user");

    const exec = await executeAction(action, ListBasedExecutor);
    let ent = await action.editedEntX();
    expect(exec.resolveValue(action.builder.placeholderID)).toStrictEqual(ent);

    // 2 operations. Edit NodeOperation still created because it's needed to resolve placeholder
    // however, no writes done. see query below

    expect(getOperations().length).toBe(2);
    QueryRecorder.validateQueryStructuresFromLogs(
      ml,
      [
        {
          tableName: "fake_edge_table",
          type: queryType.INSERT,
        },
      ],
      // skipping assoc_edge_config load and potentially sqlite select *
      { skipSelect: true },
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
    expect(getOperations().length).toBe(3);
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
      { skipSelect: true },
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

  // this test...
  // don't join a channel if we're trying to uspsert or something...
  test.only("list-with-complex-layers", async () => {
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
          id: v4(),
        },
        {
          name: "#random",
          id: v4(),
        },
        {
          name: "#fun",
          id: v4(),
        },
      ];
    }
    async function getInvitee(viewer: Viewer): Promise<User> {
      return new User(viewer, { id: v4() });
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

          for (const channel of autoJoinChannels) {
            // user -> channel edge (channel Member)
            userAction.builder.orchestrator.addOutboundEdge(
              channel.id,
              "channelMember",
              "Channel",
            );
          }

          // workspaceMember
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

          return Promise.all([
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
    expect(getOperations().length).toBe(11);
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
      { skipSelect: true },
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
                ["parentID", v4()],
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
                ["parentID", v4()],
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
        expect(convertJSON(cl.data.log)).toMatchObject({
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
}
