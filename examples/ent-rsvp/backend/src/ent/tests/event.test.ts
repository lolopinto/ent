import { Address, Event } from "src/ent";
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
      expect(e.message).toMatch(
        /Viewer with ID (.+) does not have permission to create Event/,
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
          address: {
            street: "1 main street",
            city: "San Francisco",
            state: "CA",
            zipCode: "94012",
          },
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

    const activity = activities.find((a) => a.name == "closing brunch");
    expect(activity).toBeDefined();
    if (!activity) {
      fail("impossicant");
    }
    const address = await Address.loadFromOwnerID(activity.viewer, activity.id);
    expect(address).not.toBe(null);
    expect(address?.street).toBe("1 main street");
    expect(address?.city).toBe("San Francisco");
    expect(address?.state).toBe("CA");
    expect(address?.ownerID).toBe(activity.id);
  });
});
