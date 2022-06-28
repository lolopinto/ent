import { LoggedOutViewer } from "@snowtop/ent";
import { DayOfWeek, DayOfWeekAlt } from "../";
import CreateHoursOfOperationAction from "../hours_of_operation/actions/create_hours_of_operation_action";

test("create", async () => {
  const r = await CreateHoursOfOperationAction.create(new LoggedOutViewer(), {
    dayOfWeek: DayOfWeek.Friday,
    open: "08:00",
    close: "17:00",
    dayOfWeekAlt: DayOfWeekAlt.Friday,
  }).saveX();
  expect(r.dayOfWeek).toBe(DayOfWeek.Friday);
  expect(r.dayOfWeekAlt).toBe(DayOfWeekAlt.Friday);
});
