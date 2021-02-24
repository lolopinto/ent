import { expectMutation } from "@lolopinto/ent-graphql-tests";
import { Address } from "src/ent";
import { DB } from "@lolopinto/ent";
import schema from "src/graphql/schema";
import { encodeGQLID, mustDecodeIDFromGQLID } from "@lolopinto/ent/graphql";
import { createUser } from "src/testutils";

afterAll(async () => {
  await DB.getInstance().endPool();
});

test("create event", async () => {
  const user = await createUser();
  await expectMutation(
    {
      viewer: user.viewer,
      mutation: "eventCreate",
      schema,
      args: {
        creatorID: encodeGQLID(user),
        name: "fun event",
      },
    },
    ["event.name", "fun event"],
    ["event.creator.id", encodeGQLID(user)],
  );
});
