import { StructTypeAsList, StringType, DateType } from "@snowtop/ent/schema/";

describe("date struct list", () => {
  const importantDates = StructTypeAsList({
    tsType: "ImportantDate",
    fields: {
      label: StringType(),
      date: DateType(),
    },
  });

  test("formats js Date as YYYY-MM-DD", async () => {
    const val = [
      {
        label: "Inauguration",
        date: new Date(Date.UTC(2021, 0, 20)),
      },
    ];

    expect(await importantDates.valid(val)).toBe(true);
    expect(importantDates.format(val)).toEqual(
      JSON.stringify([
        {
          label: "Inauguration",
          date: "2021-01-20",
        },
      ]),
    );
  });

  test("passes through pre-formatted strings", async () => {
    const val = [
      {
        label: "New Year",
        date: "2022-01-01",
      },
    ];

    expect(await importantDates.valid(val)).toBe(true);
    expect(importantDates.format(val)).toEqual(JSON.stringify(val));
  });
});
