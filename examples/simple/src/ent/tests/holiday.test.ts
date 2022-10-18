import { DateTime } from "luxon";
import { LoggedOutExampleViewer } from "src/viewer/viewer";
import CreateHolidayAction from "../holiday/actions/create_holiday_action";
import { DayOfWeek, DayOfWeekAlt } from "../";
import CustomCreateHolidayAction from "../holiday/actions/custom_create_holiday_action";
import { v1 } from "uuid";

test("create", async () => {
  const dt = DateTime.fromISO("2021-01-20");

  const holiday = await CreateHolidayAction.create(
    new LoggedOutExampleViewer(),
    {
      label: "inauguration",
      date: dt.toJSDate(),
      dayOfWeek: DayOfWeek.Thursday,
      dayOfWeekAlt: DayOfWeekAlt.Thursday,
    },
  ).saveX();
  expect(holiday.date.toISOString()).toBe(dt.toUTC().toISO());
  expect(holiday.label).toBe("inauguration");
  expect(holiday.dayOfWeek).toBe(DayOfWeek.Thursday);
  expect(holiday.dayOfWeekAlt).toBe(DayOfWeekAlt.Thursday);
});

test("custom create", async () => {
  const dt = DateTime.fromISO("2021-01-20");

  const holiday = await CustomCreateHolidayAction.create(
    new LoggedOutExampleViewer(),
    {
      label: "inauguration",
      date: dt.toJSDate(),
      dayOfWeek: DayOfWeek.Thursday,
      dayOfWeekAlt: DayOfWeekAlt.Thursday,
      fakeId: v1(),
    },
  ).saveX();
  expect(holiday.date.toISOString()).toBe(dt.toUTC().toISO());
  expect(holiday.label).toBe("inauguration");
  expect(holiday.dayOfWeek).toBe(DayOfWeek.Thursday);
  expect(holiday.dayOfWeekAlt).toBe(DayOfWeekAlt.Thursday);
});
