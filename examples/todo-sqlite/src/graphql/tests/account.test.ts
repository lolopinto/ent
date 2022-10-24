import { IDViewer } from "@snowtop/ent";
import { expectMutation } from "@snowtop/ent-graphql-tests";
import { Account } from "src/ent";
import { randomPhoneNumber } from "src/ent/testutils/util";
import schema from "src/graphql/generated/schema";

test("create", async () => {
  await expectMutation(
    {
      schema,
      mutation: "createAccount",
      args: {
        name: "Jon Snow",
        phone_number: randomPhoneNumber(),
      },
    },
    [
      "account.id",
      async (id: string) => {
        const account = await Account.loadX(new IDViewer(id), id);
        expect(account.accountState).toBe("UNVERIFIED");
      },
    ],
    ["account.name", "Jon Snow"],
  );
});

test("create with prefs", async () => {
  await expectMutation(
    {
      schema,
      mutation: "createAccount",
      args: {
        name: "Jon Snow",
        phone_number: randomPhoneNumber(),
        account_prefs: {
          finished_nux: true,
          enable_notifs: false,
          preferred_language: "en_US",
        },
      },
    },
    [
      "account.id",
      async (id: string) => {
        const account = await Account.loadX(new IDViewer(id), id);
        expect(account.accountState).toBe("UNVERIFIED");

        expect(account.accountPrefs).toStrictEqual({
          finishedNux: true,
          enableNotifs: false,
          preferredLanguage: "en_US",
        });
      },
    ],
    ["account.name", "Jon Snow"],
    [
      "account.account_prefs",
      {
        finished_nux: true,
        enable_notifs: false,
        preferred_language: "en_US",
      },
    ],
  );
});
