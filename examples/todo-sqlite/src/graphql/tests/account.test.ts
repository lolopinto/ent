import { LoggedOutViewer } from "@snowtop/ent";
import { IDViewer } from "@snowtop/ent";
import { expectMutation } from "@snowtop/ent-graphql-tests";
import { Account } from "src/ent";
import { randomPhoneNumber } from "src/ent/testutils/util";
import schema from "src/graphql/generated/schema";

beforeAll(() => {
  process.env.DB_CONNECTION_STRING = `sqlite:///todo.db`;
});

test("create", async () => {
  await expectMutation(
    {
      schema,
      mutation: "createAccount",
      args: {
        name: "Jon Snow",
        phone_number: randomPhoneNumber(),
        account_state: "UNVERIFIED",
      },
    },
    [
      "account.id",
      async (id: string) => {
        Account.loadX(new IDViewer(id), id);
      },
    ],
    ["account.account_state", "UNVERIFIED"],
    ["account.name", "Jon Snow"],
  );
});
