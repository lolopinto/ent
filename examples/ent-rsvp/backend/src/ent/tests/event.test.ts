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
});
