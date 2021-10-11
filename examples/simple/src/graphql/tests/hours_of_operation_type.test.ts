import { DB } from "@snowtop/ent";
import { expectMutation } from "@snowtop/ent-graphql-tests";
import schema from "../generated/schema";
import { DateTime } from "luxon";

afterAll(async () => {
  await DB.getInstance().endPool();
});

// stolen from schema/field.ts
export const leftPad = (val: number): string => {
  if (val >= 0) {
    if (val < 10) {
      return `0${val}`;
    }
    return val.toString();
  }
  if (val > -10) {
    return `-0${val * -1}`;
  }
  return val.toString();
};

test("create hours of operation", async () => {
  await expectMutation(
    {
      mutation: "hoursOfOperationCreate",
      schema,
      args: {
        dayOfWeek: "SUNDAY",
        open: "08:00:00",
        close: "17:00:00",
        dayOfWeekAlt: "SUNDAY",
      },
    },
    ["hoursOfOperation.dayOfWeek", "SUNDAY"],
    ["hoursOfOperation.dayOfWeek", "SUNDAY"],
    ["hoursOfOperation.open", "08:00:00"],
    [
      "hoursOfOperation.close",
      `17:00:00${leftPad(DateTime.local().offset / 60)}`,
    ],
  );
});
