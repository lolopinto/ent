import { DB } from "@snowtop/snowtop-ts";
import { expectMutation } from "@lolopinto/ent-graphql-tests";
import schema from "src/graphql/schema";
import luxon, { DateTime } from "luxon";

afterAll(async () => {
  await DB.getInstance().endPool();
});

test("create holiday", async () => {
  const dt = DateTime.fromISO("2021-01-20");
  await expectMutation(
    {
      mutation: "holidayCreate",
      schema,
      args: {
        label: "Inauguaration",
        date: dt.toMillis(),
      },
    },
    ["holiday.label", "Inauguaration"],
    ["holiday.date", dt.toUTC().toISO()],
  );
});
