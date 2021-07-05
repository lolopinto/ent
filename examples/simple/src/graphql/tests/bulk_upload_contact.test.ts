import { DB, LoggedOutViewer } from "@snowtop/ent";
import { randomEmail, randomPhoneNumber } from "src/util/random";
import { expectMutation } from "@snowtop/snowtop-graphql-tests";
import { encodeGQLID } from "@snowtop/ent/graphql";
import CreateUserAction from "src/ent/user/actions/create_user_action";
import schema from "src/graphql/schema";
import { graphqlUploadExpress } from "graphql-upload";

// TODO we need something that does this by default for all tests
afterAll(async () => {
  await DB.getInstance().endPool();
});

test("bulk upload", async () => {
  const user = await CreateUserAction.create(new LoggedOutViewer(), {
    firstName: "Jon",
    lastName: "snow",
    emailAddress: randomEmail(),
    phoneNumber: randomPhoneNumber(),
    password: "pa$$w0rd",
  }).saveX();

  const csv = `firstName, lastName, emailAddress
  Arya, Stark, ${randomEmail()}
  Robb, Stark, ${randomEmail()}
  Rickon, Stark, ${randomEmail()}
  Bran, Stark, ${randomEmail()}
  Rickon, Stark, ${randomEmail()}`;

  await expectMutation(
    {
      viewer: user.viewer,
      schema: schema,
      mutation: "bulkUploadContact",
      args: {
        userID: encodeGQLID(user),
        file: Buffer.from(csv),
      },
      disableInputWrapping: true,
      customHandlers: [
        graphqlUploadExpress({ maxFileSize: 10000000, maxFiles: 10 }),
      ],
    },
    ["id", encodeGQLID(user)],
    ["contacts.rawCount", 6], // 5 contacts + self contact
  );
});
