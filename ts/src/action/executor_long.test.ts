import { Viewer } from "../core/base";
import { loadRows } from "../core/ent";
import * as clause from "../core/clause";
import { WriteOperation } from "../action/action";

import { User, Group, SimpleAction, BuilderSchema } from "../testutils/builder";
import { LoggedOutViewer } from "../core/viewer";

import { setupPostgres } from "../testutils/db/temp_db";
import {
  createGroup,
  createUser,
  getTables,
  GroupSchema,
  MessageAction,
  setupTest,
} from "../testutils/action/complex_schemas";

setupTest();

jest.setTimeout(30 * 1000);

// only doing postgres because don't think we get much benefit from both
setupPostgres(getTables);

test("nested + Promise.all with lots of actions", async () => {
  // TODO eventually figure out how to make this run in ci
  if (process.env.GITHUB_ACTION !== undefined) {
    return;
  }
  const NUM_USERS = 500;
  const host = await createUser();
  const users: User[] = [];
  for (let i = 0; i < NUM_USERS; i++) {
    users.push(await createUser());
  }

  class SendWelcomeGroupMessageAction extends SimpleAction<Group> {
    constructor(
      public viewer: Viewer,
      schema: BuilderSchema<Group>,
      fields: Map<string, any>,
      existingEnt: Group,
      host: User,
      users: User[],
    ) {
      super(viewer, schema, fields, WriteOperation.Edit, existingEnt);
      this.builder.storeData("host", host);
      this.builder.storeData("users", users);
    }

    getObservers = () => [
      {
        async observe(builder, input) {
          const host = builder.getStoredData("host") as User;
          const users = builder.getStoredData("users") as User[];

          await Promise.all(
            users.map(async (user) => {
              // create welcome message to each user from host
              const action = new CreateMessageAction(
                builder.viewer,
                new Map<string, any>([
                  ["sender", host.id],
                  ["recipient", user.id],
                  ["message", "Welcome to the group!"],
                  ["transient", false],
                  ["expiresAt", new Date()],
                ]),
                WriteOperation.Insert,
                null,
              );
              await action.saveX();
            }),
          );
        },
      },
    ];
  }

  class DeliverMessageAction extends MessageAction {
    getObservers = () => [
      {
        async observe(builder, input) {
          // deliver message to recipient
          const message = await builder.editedEntX();

          const action = new MessageAction(
            builder.viewer,
            new Map([["delivered", true]]),
            WriteOperation.Edit,
            message,
          );
          await action.saveX();
        },
      },
    ];
  }

  class CreateMessageAction extends MessageAction {
    getObservers = () => [
      {
        async observe(builder, input) {
          const message = await builder.editedEntX();
          // deliver the notif
          const action = new DeliverMessageAction(
            builder.viewer,
            new Map(),
            WriteOperation.Edit,
            message,
          );
          await action.saveX();
        },
      },
    ];
  }

  const group = await createGroup();
  const action = new SendWelcomeGroupMessageAction(
    new LoggedOutViewer(),
    GroupSchema,
    new Map(),
    group,
    host,
    users,
  );
  await action.saveX();

  const messages = await loadRows({
    clause: clause.Eq("sender", host.id),
    fields: ["*"],
    tableName: "messages",
  });
  expect(messages.length).toBe(NUM_USERS);
  expect(messages.every((message) => message.delivered)).toBeTruthy();
});
