import { expectMutation } from "@snowtop/ent-graphql-tests";
import { Tag } from "src/ent";
import { createAccount, createTag } from "src/ent/testutils/util";
import schema from "src/graphql/generated/schema";

test("create", async () => {
  const account = await createAccount();
  const tag = await createTag("friend", account);
  await expectMutation(
    {
      viewer: account.viewer,
      schema,
      mutation: "createTag",
      args: {
        owner_id: account.id,
        display_name: "SPORTS",
        related_tag_ids: [tag.id],
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
    ["tag.related_tags[0].id", tag.id],
  );
});

test("create no tags", async () => {
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
      nullQueryPaths: ["tag.related_tags"],
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
    ["tag.related_tags[0].id", null],
  );
});
