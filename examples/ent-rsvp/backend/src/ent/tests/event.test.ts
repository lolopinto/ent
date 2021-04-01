import { Event } from "src/ent";
import { DB, IDViewer } from "@lolopinto/ent";
import CreateEventAction from "../event/actions/create_event_action";
import { createUser } from "src/testutils";

afterAll(async () => {
  await DB.getInstance().endPool();
});

describe("create event", () => {
  test("valid", async () => {
    const user = await createUser();
    const event = await CreateEventAction.create(new IDViewer(user.id), {
      creatorID: user.id,
      name: `${user.firstName}'s wedding`,
    }).saveX();
    expect(event).toBeInstanceOf(Event);
  });

  test("invalid", async () => {
    const [user, user2] = await Promise.all([createUser(), createUser()]);
    try {
      await CreateEventAction.create(new IDViewer(user.id), {
        creatorID: user2.id,
        name: `${user.firstName}'s wedding`,
      }).saveX();
      fail("should have thrown");
    } catch (e) {
      expect(e.message).toBe(
        "ent undefined is not visible for privacy reasons",
      );
    }
  });

  test("create activities also", async () => {
    let user = await createUser();

    const event = await CreateEventAction.create(user.viewer, {
      name: "fun event",
      creatorID: user.id,
      activities: [
        {
          startTime: new Date(),
          location: "location",
          name: "welcome dinner",
          inviteAllGuests: true,
        },
        {
          startTime: new Date(),
          name: "closing brunch",
          location: "whaa",
          description: "all are welcome",
          // TODO it doesn't add actionOnlyFields!!!
          // TODO address
          //          address: {},
        },
      ],
    }).saveX();
    expect(event).toBeInstanceOf(Event);
    const activities = await event.queryEventActivities().queryEnts();
    expect(activities.length).toBe(2);

    expect(activities.map((a) => a.name).sort()).toStrictEqual([
      "closing brunch",
      "welcome dinner",
    ]);
  });
});
