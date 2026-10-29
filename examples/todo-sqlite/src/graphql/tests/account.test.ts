import { IDViewer, LoggedOutViewer } from "@snowtop/ent";
import { graphql } from "graphql";
import {
  expectMutation,
  expectQueryFromRoot,
} from "@snowtop/ent-graphql-tests";
import { Account } from "src/ent";
import { TestContext } from "@snowtop/ent/testutils/context/test_context";
import {
  createAccount,
  createTodoForSelf,
  randomPhoneNumber,
} from "src/ent/testutils/util";
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
        account_prefs_list: [
          {
            finished_nux: true,
            enable_notifs: false,
            preferred_language: "en_US",
          },
        ],
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
        expect(account.accountPrefsList).toStrictEqual([
          {
            finishedNux: true,
            enableNotifs: false,
            preferredLanguage: "en_US",
          },
        ]);
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
    [
      "account.account_prefs_list",
      [
        {
          finished_nux: true,
          enable_notifs: false,
          preferred_language: "en_US",
        },
      ],
    ],
  );
});

test("create with literal structs and nested struct lists", async () => {
  // Keep the struct values inline: expectMutation supplies JSON variables, which
  // do not exercise GraphQL's null-prototype literal inputs. Using $phone shows
  // that variables elsewhere in the request do not prevent the struct failure.
  const result = await graphql({
    schema,
    source: `mutation($phone: String!) {
      createAccount(input: {
        name: "Literal structs"
        phone_number: $phone
        account_prefs: {finished_nux: true, enable_notifs: false, preferred_language: "en_US"}
        account_prefs_list: [{finished_nux: false, enable_notifs: true, preferred_language: "fr_FR"}]
        country_infos: [{countries: [{
          name: "France", code: "FR", capital: {name: "Paris", population: "2100000"}
        }]}]
      }) { account { id } }
    }`,
    variableValues: { phone: randomPhoneNumber() },
    contextValue: { getViewer: () => new LoggedOutViewer() },
  });
  expect(result.errors).toBeUndefined();
  const id = (result.data as any).createAccount.account.id;
  const account = await Account.loadX(new IDViewer(id), id);
  expect(account.accountPrefs).toStrictEqual({
    finishedNux: true,
    enableNotifs: false,
    preferredLanguage: "en_US",
  });
  expect(account.accountPrefsList).toStrictEqual([
    { finishedNux: false, enableNotifs: true, preferredLanguage: "fr_FR" },
  ]);
  expect(account.countryInfos).toStrictEqual([
    {
      countries: [
        {
          name: "France",
          code: "FR",
          capital: { name: "Paris", population: "2100000" },
        },
      ],
    },
  ]);
});

test("viewer_can_see", async () => {
  const account = await createAccount();
  const account2 = await createAccount();

  await expectQueryFromRoot(
    {
      schema,
      viewer: account.viewer,
      args: {
        id: account.id,
      },
      root: "account",
    },

    ["id", account.id],
    ["can_viewer_see_info.phone_number", true],
  );

  await expectQueryFromRoot(
    {
      schema,
      viewer: account.viewer,
      args: {
        id: account2.id,
      },
      root: "account",
    },

    ["id", account2.id],
    ["can_viewer_see_info.phone_number", false],
  );
});

test.each(["anonymous", "unrelated", "self"])(
  "account mutations reject %s callers before changing data",
  async (mode) => {
    const account = await createAccount();
    const other = await createAccount();
    const todo = await createTodoForSelf({ creatorId: account.id });
    const viewer =
      mode === "self"
        ? account.viewer
        : mode === "unrelated"
          ? other.viewer
          : new LoggedOutViewer();

    const mutations: [string, string, Record<string, unknown>][] = [
      // no one, including the account, can set its balance directly
      [
        "accountUpdateBalance",
        "AccountUpdateBalanceInput",
        { id: account.id, credits: 1000000 },
      ],
    ];
    if (mode !== "self") {
      mutations.push(
        [
          "accountTransferCredits",
          "AccountTransferCreditsInput",
          { id: account.id, to: other.id, amount: 100 },
        ],
        ["editAccount", "EditAccountInput", { id: account.id, name: "Aegon" }],
        [
          "todoStatusAccountEdit",
          "TodoStatusAccountEditInput",
          { id: account.id, todo_id: todo.id, todo_status: "CLOSED_TODOS_DUP" },
        ],
        ["deleteAccount", "DeleteAccountInput", { id: account.id }],
      );
    }
    for (const [mutation, inputType, input] of mutations) {
      const result = await graphql({
        schema,
        source: `mutation($input: ${inputType}!) { ${mutation}(input: $input) { __typename } }`,
        variableValues: { input },
        contextValue: new TestContext(viewer),
      });
      expect(result.errors?.length, mutation).toBeGreaterThan(0);
      expect(result.errors![0].message, mutation).toMatch(
        /does not have permission/,
      );
    }

    const reloaded = await Account.loadX(account.viewer, account.id);
    expect(reloaded.credits).toBe(1000);
    expect(reloaded.name).toBe(account.name);
    expect(await reloaded.todoStatusFor(todo)).toBeNull();
    const reloadedOther = await Account.loadX(other.viewer, other.id);
    expect(reloadedOther.credits).toBe(1000);
  },
);

test("account can transfer its own credits", async () => {
  const account = await createAccount();
  const other = await createAccount();
  await expectMutation(
    {
      viewer: account.viewer,
      schema,
      mutation: "accountTransferCredits",
      args: { id: account.id, to: other.id, amount: 100 },
    },
    ["account.id", account.id],
  );
  const reloaded = await Account.loadX(account.viewer, account.id);
  expect(reloaded.credits).toBe(900);
  const reloadedOther = await Account.loadX(other.viewer, other.id);
  expect(reloadedOther.credits).toBe(1100);
});
