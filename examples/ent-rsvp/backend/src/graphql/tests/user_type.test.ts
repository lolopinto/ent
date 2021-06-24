import { expectMutation } from "@snowtop/snowtop-graphql-tests";
import { User } from "src/ent";
import { DB, IDViewer } from "@snowtop/snowtop-ts";
import schema from "src/graphql/schema";
import { mustDecodeIDFromGQLID } from "@snowtop/snowtop-ts/graphql";
import { randomEmail } from "src/util/random";

afterAll(async () => {
  await DB.getInstance().endPool();
});

test("create user", async () => {
  const email = randomEmail();
  await expectMutation(
    {
      mutation: "userCreate",
      schema,
      args: {
        firstName: "Jon",
        lastName: "Snow",
        emailAddress: email,
        password: "pa$$w0rd",
      },
    },
    ["user.firstName", "Jon"],
    ["user.lastName", "Snow"],
    ["user.emailAddress", email],
    [
      "user.id",
      async function (id) {
        const decoded = mustDecodeIDFromGQLID(id);
        const vc = new IDViewer(decoded);
        await User.loadX(vc, decoded);
      },
    ],
  );
});
