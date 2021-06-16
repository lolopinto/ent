import CreateTagAction from "src/ent/tag/actions/create_tag_action";
import { createAccount } from "../testutils/util";
import { Account } from "src/ent";
import { create } from "domain";
import { AccountToTagsQuery } from "../account/query/account_to_tags_query";

beforeAll(() => {
  process.env.DB_CONNECTION_STRING = `sqlite:///todo.db`;
});

async function createTag(displayName: string, account?: Account) {
  if (!account) {
    account = await createAccount();
  }

  const tag = await CreateTagAction.create(account.viewer, {
    ownerID: account.id,
    displayName,
  }).saveX();
  expect(tag.displayName).toBe(displayName);
  expect(tag.canonicalName).toBe(displayName.trim().toLowerCase());
  expect(tag.ownerID).toBe(account.id);
}

test("create", async () => {
  await createTag("SPORTS");
});

describe("duplicate", () => {
  test("same display name", async () => {
    const account = await createAccount();

    await createTag("SPORTS", account);

    try {
      await createTag("SPORTS", account);
      fail("should have thrown");
    } catch (err) {
      expect(err.message).toMatch(/UNIQUE constraint failed/);
    }
  });

  test("diff display name, same canonical", async () => {
    const account = await createAccount();

    await createTag("SPORTS", account);

    try {
      await createTag("sports", account);
      fail("should have thrown");
    } catch (err) {
      expect(err.message).toMatch(/UNIQUE constraint failed/);
    }
  });

  test("diff name", async () => {
    const account = await createAccount();

    await createTag("SPORTS", account);
    await createTag("kids", account);

    const count = await AccountToTagsQuery.query(
      account.viewer,
      account.id,
    ).queryCount();
    expect(count).toBe(2);

    const ents = await AccountToTagsQuery.query(
      account.viewer,
      account.id,
    ).queryEnts();
    expect(ents.map((ent) => ent.canonicalName).sort()).toEqual([
      "kids",
      "sports",
    ]);
  });
});
