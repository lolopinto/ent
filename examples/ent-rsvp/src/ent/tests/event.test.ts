import { Event, User } from "src/ent";
import { DB, IDViewer, LoggedOutViewer } from "@lolopinto/ent";
import CreateUserAction from "../user/actions/create_user_action";
import { randomEmail } from "src/util/random";
import CreateEventAction from "../event/actions/create_event_action";

afterAll(async () => {
  await DB.getInstance().endPool();
});

async function createUser() {
  const user = await CreateUserAction.create(new LoggedOutViewer(), {
    firstName: "Jon",
    lastName: "Snow",
    emailAddress: randomEmail(),
  }).saveX();
  expect(user).toBeInstanceOf(User);
  return user;
}

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
