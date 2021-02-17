import { expectMutation } from "@lolopinto/ent-graphql-tests";
import { Address, User } from "src/ent";
import { DB, LoggedOutViewer } from "@lolopinto/ent";
import CreateUserAction from "src/ent/user/actions/create_user_action";
import { randomEmail } from "src/util/random";
import schema from "src/graphql/schema";
import { encodeGQLID, mustDecodeIDFromGQLID } from "@lolopinto/ent/graphql";

afterAll(async () => {
  await DB.getInstance().endPool();
});

async function createUser() {
  const user = await CreateUserAction.create(new LoggedOutViewer(), {
    firstName: "Jon",
    lastName: "Snow",
    emailAddress: randomEmail(),
  }).saveX();
  expect(user).toBeInstanceOf(User);
  return user;
}

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
        address: {
          street: "1 main street",
          city: "San Francisco",
          state: "CA",
          zipCode: "91111",
        },
      },
    },
    ["event.name", "fun event"],
    ["event.creator.id", encodeGQLID(user)],
    [
      "event.id",
      async function(id) {
        const address = await Address.loadFromOwnerID(
          user.viewer,
          mustDecodeIDFromGQLID(id),
        );
        expect(address).not.toBeNull();
        expect(address?.street).toBe("1 main street");
        expect(address?.city).toBe("San Francisco");
        expect(address?.state).toBe("CA");
        expect(address?.zipCode).toBe("91111");
      },
    ],
  );
});
