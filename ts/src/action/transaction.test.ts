import { Ent } from "../core/base";
import { WriteOperation } from "../action/action";

import DB from "../core/db";

import { QueryRecorder, queryType } from "../testutils/db_mock";
import { User, Message, SimpleAction } from "../testutils/builder";
import { LoggedOutViewer, IDViewer } from "../core/viewer";
import { setupPostgres, setupSqlite } from "../testutils/db/temp_db";
import { Transaction } from "./transaction";
import {
  Account,
  AccountSchema,
  createGroup,
  createUser,
  getML,
  getTables,
  GroupMemberOf,
  GroupMemberOfSchema,
  GroupSchema,
  MessageAction,
  setupTest,
  UserAction,
} from "../testutils/action/complex_schemas";

setupTest();
const ml = getML();

describe("postgres", () => {
  setupPostgres(getTables);
  commonTests();
});

describe("sqlite", () => {
  setupSqlite(`sqlite:///transaction-test.db`, getTables);
  commonTests();
});

function validateOneTransaction() {
  let beginIdx: number[] = [];
  let insertIdx: number[] = [];
  let updateIdx: number[] = [];
  let deleteIdx: number[] = [];
  let commitIdx: number[] = [];
  let rollbackIdx: number[] = [];

  for (let i = 0; i < ml.logs.length; i++) {
    const log = ml.logs[i];
    if (!log.query) {
      continue;
    }

    let r = QueryRecorder.getQueryStructure(log.query);
    if (r === null) {
      continue;
    }
    switch (r.type) {
      case queryType.BEGIN:
        beginIdx.push(i);
        break;

      case queryType.COMMIT:
        commitIdx.push(i);
        break;

      case queryType.ROLLBACK:
        rollbackIdx.push(i);
        break;

      case queryType.UPDATE:
        updateIdx.push(i);
        break;

      case queryType.INSERT:
        insertIdx.push(i);
        break;

      case queryType.DELETE:
        deleteIdx.push(i);
        break;
    }
  }

  const beginCommit = DB.getInstance().emitsExplicitTransactionStatements();

  if (beginCommit) {
    expect(beginIdx.length).toBe(1);
    if (beginIdx.length === 0) {
      expect(false, "no BEGIN statement found");
    } else if (beginIdx.length > 1) {
      expect(false, `${beginIdx.length} BEGIN statements found`);
    }

    expect(commitIdx.length).toBe(1);
    if (commitIdx.length === 0) {
      expect(false, "no COMMIT statement found");
    } else if (commitIdx.length > 1) {
      expect(false, `${commitIdx.length} COMMIT statements found`);
    }
  } else {
    expect(beginIdx.length).toBe(0);
    expect(commitIdx.length).toBe(0);
  }

  if (beginCommit) {
    if (insertIdx.length) {
      expect(insertIdx[0]).toBeGreaterThan(beginIdx[0]);
      expect(insertIdx[0]).toBeLessThan(commitIdx[0]);
    }

    if (updateIdx.length) {
      expect(updateIdx[0]).toBeGreaterThan(beginIdx[0]);
      expect(updateIdx[0]).toBeLessThan(commitIdx[0]);
    }

    if (deleteIdx.length) {
      expect(deleteIdx[0]).toBeGreaterThan(beginIdx[0]);
      expect(deleteIdx[0]).toBeLessThan(commitIdx[0]);
    }
  }

  expect(rollbackIdx.length).toBe(0);
}

function commonTests() {
  // lol, this already has dependencies!
  test("nested siblings", async () => {
    const group = await createGroup();
    ml.clear();

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

    const tx = new Transaction(group.viewer, actions);
    await tx.run();

    validateOneTransaction();

    const ents = await Promise.all(actions.map((action) => action.editedEnt()));
    const users = ents.slice(0, inputs.length) as User[];
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

  test("transaction with dependencies btw actions + large array", async () => {
    const user = await createUser();

    const members = await Promise.all([...Array(100).keys()].map(createUser));

    const actions: SimpleAction<Ent>[] = [];

    const viewer = new IDViewer(user.id);
    const groupAction = new SimpleAction(
      viewer,
      GroupSchema,
      new Map<string, any>([["name", "group"]]),
      WriteOperation.Insert,
      null,
    );
    actions.push(groupAction);

    const groupMemberActions: SimpleAction<GroupMemberOf>[] = [];

    members.forEach((member) => {
      const action = new SimpleAction(
        viewer,
        GroupMemberOfSchema,
        new Map<string, any>([
          ["userID", member.id],
          ["addedBy", viewer.viewerID!],
          ["groupID", groupAction.builder],
          ["notificationsEnabled", true],
        ]),
        WriteOperation.Insert,
        null,
      );
      actions.push(action);
      groupMemberActions.push(action);
    });

    const tx = new Transaction(viewer, actions);
    await tx.run();

    validateOneTransaction();

    const group = await groupAction.editedEntX();
    expect(group.data.name).toBe("group");

    await Promise.all(
      groupMemberActions.map(async (action) => {
        const ent = await action.editedEntX();
        expect(ent.data.group_id).toBe(group.id);
        expect(ent.data.added_by).toBe(viewer.viewerID);
      }),
    );
  });

  // TODO would be nice to test that nested transactions aren't allowed
  // i can't think of any way that doesn't involve manual SQL statements
}
