import { expectMutation } from "@snowtop/ent-graphql-tests";
import { User } from "../../ent/index.js";
import { IDViewer } from "@snowtop/ent";
import schema from "../generated/schema.js";
import { mustDecodeIDFromGQLID } from "@snowtop/ent/graphql";
import { randomEmail } from "../../util/random.js";

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
      async function (id: string) {
        const decoded = mustDecodeIDFromGQLID(id);
        const vc = new IDViewer(decoded);
        await User.loadX(vc, decoded);
      },
    ],
  );
});
