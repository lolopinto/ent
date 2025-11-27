import { ID } from "@snowtop/ent";
import { expectMutation } from "@snowtop/ent-graphql-tests";
import schema from "../generated/schema";
import { DateTime } from "luxon";
import { encodeGQLID, mustDecodeIDFromGQLID } from "@snowtop/ent/graphql";
import { Holiday } from "src/ent";
import { LoggedOutExampleViewer } from "../../viewer/viewer";
import { DayOfWeek, DayOfWeekAlt } from "../../ent/generated/types";

test("create and edit holiday", async () => {
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
        log: {
          what: "foo",
          bar: "int",
        },
      },
    },
    ["holiday.label", "Inauguration"],
    ["holiday.date", "2021-01-20"],
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

  await expectMutation(
    {
      mutation: "holidayCustomEdit",
      schema,
      viewer: new LoggedOutExampleViewer(),
      args: {
        id: encodeGQLID(ent),
        label: "Inauguration2",
      },
      // ok to be safely null since logged out can't do it
      nullQueryPaths: ["holiday"],
    },
    ["holiday.label", "Inauguration2"],
  );
});
