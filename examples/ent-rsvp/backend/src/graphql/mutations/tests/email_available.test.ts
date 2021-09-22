import {
  expectMutation,
  expectQueryFromRoot,
} from "@snowtop/ent-graphql-tests";
import { IDViewer, DB } from "@snowtop/ent";
// import { encodeGQLID } from "@snowtop/ent/graphql";
// import { createGuestPlus } from "src/testutils";
// this needs to be the last line becasue of load order or at least after src/testutils
import { randomEmail } from "src/util/random";
import schema from "src/graphql/generated/schema";
import { createUser } from "src/testutils";

afterAll(async () => {
  await DB.getInstance().endPool();
});

describe("mutation", () => {
  test("available", async () => {
    const email = randomEmail();

    await expectMutation(
      {
        mutation: "emailAvailable",
        disableInputWrapping: true,
        schema,
        args: {
          email,
        },
      },
      ["", true],
    );
  });

  test("not available", async () => {
    const user = await createUser();

    await expectMutation(
      {
        mutation: "emailAvailable",
        disableInputWrapping: true,
        schema,
        args: {
          email: user.emailAddress,
        },
      },
      ["", false],
    );
  });

  test("not available different case", async () => {
    const user = await createUser();

    await expectMutation(
      {
        mutation: "emailAvailable",
        disableInputWrapping: true,
        schema,
        args: {
          email: user.emailAddress.toUpperCase(),
        },
      },
      ["", false],
    );
  });
});

describe("query", () => {
  test("available", async () => {
    const email = randomEmail();

    await expectQueryFromRoot(
      {
        root: "emailAvailable",
        schema,
        args: {
          email,
        },
      },
      ["", true],
    );
  });

  test("not available", async () => {
    const user = await createUser();

    await expectQueryFromRoot(
      {
        root: "emailAvailable",
        schema,
        args: {
          email: user.emailAddress,
        },
      },
      ["", false],
    );
  });

  test("not available different case", async () => {
    const user = await createUser();

    await expectQueryFromRoot(
      {
        root: "emailAvailable",
        schema,
        args: {
          email: user.emailAddress.toUpperCase(),
        },
      },
      ["", false],
    );
  });
});
