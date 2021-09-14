import { IDViewer, LoggedOutViewer, DB, ID } from "@snowtop/ent";
import { User, UserToFriendsQuery, UserToSelfContactQuery } from "..";
import CreateUserAction, {
  UserCreateInput,
} from "../user/actions/create_user_action";
import CreateEventAction from "../event/actions/create_event_action";
import { randomEmail, randomPhoneNumber } from "../../util/random";

const loggedOutViewer = new LoggedOutViewer();

// TODO we need something that does this by default for all tests
afterAll(async () => {
  await DB.getInstance().endPool();
});

async function create(opts: Partial<UserCreateInput>): Promise<User> {
  let input: UserCreateInput = {
    firstName: "Jon",
    lastName: "Snow",
    emailAddress: randomEmail(),
    phoneNumber: randomPhoneNumber(),
    password: "pa$$w0rd",
    ...opts,
  };
  return await CreateUserAction.create(loggedOutViewer, input).saveX();
}

test("self contact query", async () => {
  let user = await create({
    firstName: "Jon",
    lastName: "Snow",
  });
  let vc = new IDViewer(user.id);
  user = await User.loadX(vc, user.id);
  let selfContact = await user.loadSelfContact();

  const contacts = await UserToSelfContactQuery.query(vc, user.id).queryEnts();

  expect(contacts).toStrictEqual([selfContact]);
});

test("friends query", async () => {
  let dany = await create({
    firstName: "Daenerys",
    lastName: "Targaryen",
  });
  let sam = await create({
    firstName: "Samwell",
    lastName: "Tarly",
  });

  let action = CreateUserAction.create(loggedOutViewer, {
    firstName: "Jon",
    lastName: "Snow",
    emailAddress: randomEmail(),
    phoneNumber: randomPhoneNumber(),
    password: "pa$$w0rd",
  });
  let t = new Date();
  t.setTime(t.getTime() + 86400);
  action.builder.addFriend(dany).addFriendID(sam.id, {
    time: t,
  });
  const jon = await action.saveX();

  const vc = new IDViewer(jon.id);
  const query = UserToFriendsQuery.query(vc, jon.id);

  const [count, ids] = await Promise.all([
    query.queryRawCount(),
    query.queryIDs(),
  ]);

  expect(count).toBe(2);
  // sam more recent so always gonna come back before dany
  expect(ids).toStrictEqual([sam.id, dany.id]);
});

test("chained queries", async () => {
  let dany = await create({
    firstName: "Daenerys",
    lastName: "Targaryen",
  });
  let sam = await create({
    firstName: "Samwell",
    lastName: "Tarly",
  });
  let action = CreateUserAction.create(loggedOutViewer, {
    firstName: "Jon",
    lastName: "Snow",
    emailAddress: randomEmail(),
    phoneNumber: randomPhoneNumber(),
    password: "paaa",
  });
  action.builder.addFriend(dany).addFriendID(sam.id);
  const jon = await action.saveX();

  const [event, event2] = await Promise.all([
    CreateEventAction.create(loggedOutViewer, {
      name: "fun event",
      creatorID: sam.id,
      startTime: new Date(),
      location: "location",
    }).saveX(),
    CreateEventAction.create(loggedOutViewer, {
      name: "fun event 2",
      creatorID: dany.id,
      startTime: new Date(),
      location: "location 2",
    }).saveX(),
  ]);

  const vc = new IDViewer(jon.id);
  const chainedIDs = await UserToFriendsQuery.query(vc, jon.id)
    .queryUserToHostedEvents()
    .queryAllIDs();

  const expectedResult = new Map<ID, ID[]>();
  expectedResult.set(sam.id, [event.id]);
  expectedResult.set(dany.id, [event2.id]);

  expect(chainedIDs).toStrictEqual(expectedResult);
});
