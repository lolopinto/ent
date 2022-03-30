import { expectMutation } from "@snowtop/ent-graphql-tests";
import { Tag } from "src/ent";
import { createAccount } from "src/ent/testutils/util";
import schema from "src/graphql/generated/schema";

beforeAll(() => {
  process.env.DB_CONNECTION_STRING = `sqlite:///todo.db`;
});

test("create", async () => {
  const account = await createAccount();
  await expectMutation(
    {
      viewer: account.viewer,
      schema,
      mutation: "createTag",
      args: {
        owner_id: account.id,
        display_name: "SPORTS",
      },
    },
    [
      "tag.id",
      async (id: string) => {
        await Tag.loadX(account.viewer, id);
      },
    ],
    ["tag.display_name", "SPORTS"],
    ["tag.canonical_name", "sports"],
    ["tag.owner.id", account.id],
  );
});
