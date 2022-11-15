import { ID } from "@snowtop/ent";
import { expectMutation } from "@snowtop/ent-graphql-tests";
import schema from "../generated/schema";
import { mustDecodeIDFromGQLID } from "@snowtop/ent/graphql";
import { HoursOfOperation } from "src/ent";
import { LoggedOutExampleViewer } from "../../viewer/viewer";
import { DBTimeZone } from "@snowtop/ent/testutils/db_time_zone";
import { DayOfWeek, DayOfWeekAlt } from "../../ent/generated/types";

test("create hours of operation", async () => {
  let id: ID;

  let offset = await DBTimeZone.getDateOffset(new Date());

  await expectMutation(
    {
      mutation: "hoursOfOperationCreate",
      schema,
      args: {
        // pass graphql values
        dayOfWeek: "SUNDAY",
        open: "08:00:00",
        close: "17:00:00",
        dayOfWeekAlt: "SUNDAY",
      },
    },
    [
      "hoursOfOperation.id",
      function (val: string) {
        id = mustDecodeIDFromGQLID(val);
      },
    ],
    ["hoursOfOperation.dayOfWeek", "SUNDAY"],
    ["hoursOfOperation.dayOfWeek", "SUNDAY"],
    ["hoursOfOperation.open", "08:00:00"],
    ["hoursOfOperation.close", `17:00:00${offset}`],
  );
  const ent = await HoursOfOperation.loadX(new LoggedOutExampleViewer(), id!);
  expect(ent.dayOfWeek).toBe(DayOfWeek.Sunday);
  expect(ent.dayOfWeekAlt).toBe(DayOfWeekAlt.Sunday);
});
