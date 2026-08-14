import { LoggedOutExampleViewer } from "../../viewer/viewer.js";
import CreateHolidayAction from "../holiday/actions/create_holiday_action.js";
import { DayOfWeek, DayOfWeekAlt } from "../generated/types.js";
import CustomCreateHolidayAction from "../holiday/actions/custom_create_holiday_action.js";
import { v1 } from "uuid";

test("create", async () => {
  const holiday = await CreateHolidayAction.create(
    new LoggedOutExampleViewer(),
    {
      label: "inauguration",
      date: "2021-01-20",
      dayOfWeek: DayOfWeek.Thursday,
      dayOfWeekAlt: DayOfWeekAlt.Thursday,
    },
  ).saveX();
  expect(holiday.date).toBe("2021-01-20");
  expect(holiday.label).toBe("inauguration");
  expect(holiday.dayOfWeek).toBe(DayOfWeek.Thursday);
  expect(holiday.dayOfWeekAlt).toBe(DayOfWeekAlt.Thursday);
});

test("custom create", async () => {
  const holiday = await CustomCreateHolidayAction.create(
    new LoggedOutExampleViewer(),
    {
      label: "inauguration",
      date: "2021-01-20",
      dayOfWeek: DayOfWeek.Thursday,
      dayOfWeekAlt: DayOfWeekAlt.Thursday,
      fakeId: v1(),
    },
  ).saveX();
  expect(holiday.date).toBe("2021-01-20");
  expect(holiday.label).toBe("inauguration");
  expect(holiday.dayOfWeek).toBe(DayOfWeek.Thursday);
  expect(holiday.dayOfWeekAlt).toBe(DayOfWeekAlt.Thursday);
});
