import {
  expectMutation,
  expectQueryFromRoot,
} from "@snowtop/ent-graphql-tests";
// import { encodeGQLID } from "@snowtop/ent/graphql";
// import { createGuestPlus } from "src/testutils";
// this needs to be the last line becasue of load order or at least after src/testutils
import { randomEmail } from "../../../util/random.js";
import schema from "../../generated/schema.js";
import { createUser } from "../../../testutils/index.js";

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
