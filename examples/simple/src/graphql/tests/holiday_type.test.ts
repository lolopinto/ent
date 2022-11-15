import { ID } from "@snowtop/ent";
import { expectMutation } from "@snowtop/ent-graphql-tests";
import schema from "../generated/schema";
import { DateTime } from "luxon";
import { mustDecodeIDFromGQLID } from "@snowtop/ent/graphql";
import { Holiday } from "src/ent";
import { LoggedOutExampleViewer } from "../../viewer/viewer";
import { DayOfWeek, DayOfWeekAlt } from "../../ent/generated/types";

test("create holiday", async () => {
  let id: ID;

  const dt = DateTime.fromISO("2021-01-20");
  await expectMutation(
    {
      mutation: "holidayCreate",
      schema,
      args: {
        label: "Inauguration",
        date: dt.toMillis(),
        dayOfWeek: "WEDNESDAY",
        dayOfWeekAlt: "WEDNESDAY",
      },
    },
    ["holiday.label", "Inauguration"],
    ["holiday.date", dt.toUTC().toISO()],
    ["holiday.dayOfWeek", "WEDNESDAY"],
    ["holiday.dayOfWeekAlt", "WEDNESDAY"],
    [
      "holiday.id",
      function (val: string) {
        id = mustDecodeIDFromGQLID(val);
      },
    ],
  );
  const ent = await Holiday.loadX(new LoggedOutExampleViewer(), id!);
  expect(ent.dayOfWeek).toBe(DayOfWeek.Wednesday);
  expect(ent.dayOfWeekAlt).toBe(DayOfWeekAlt.Wednesday);
});
