import { DB } from "@lolopinto/ent";
import { expectMutation } from "@lolopinto/ent-graphql-tests";
import schema from "src/graphql/schema";

afterAll(async () => {
  await DB.getInstance().endPool();
});

test("create hours of operation", async () => {
  await expectMutation(
    {
      mutation: "hoursOfOperationCreate",
      schema,
      args: {
        dayOfWeek: "SUNDAY",
        open: "08:00:00",
        close: "17:00:00",
      },
    },
    ["hoursOfOperation.dayOfWeek", "SUNDAY"],
    ["hoursOfOperation.open", "08:00:00"],
    ["hoursOfOperation.close", "17:00:00-08"], // TODO
  );
});
