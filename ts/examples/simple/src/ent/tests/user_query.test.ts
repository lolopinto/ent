import { User, Contact, Event } from "src/ent/";

import {
  Viewer,
  AssocEdge,
  AssocEdgeInput,
  IDViewer,
  LoggedOutViewer,
  DB,
} from "@lolopinto/ent";

import CreateUserAction, {
  UserCreateInput,
} from "src/ent/user/actions/create_user_action";
import EditUserAction from "src/ent/user/actions/edit_user_action";
import DeleteUserAction from "src/ent/user/actions/delete_user_action";
import CreateEventAction from "src/ent/event/actions/create_event_action";
import CreateContactAction from "src/ent/contact/actions/create_contact_action";
import { FakeLogger } from "@lolopinto/ent/testutils/fake_log";
import { FakeComms, Mode } from "@lolopinto/ent/testutils/fake_comms";
import { randomEmail } from "src/util/random";
import {
  UserToFriendsQuery,
  UserToSelfContactQuery,
} from "../generated/user_query_base";

const loggedOutViewer = new LoggedOutViewer();

// TODO we need something that does this by default for all tests
afterAll(async () => {
  await DB.getInstance().endPool();
});

async function create(input: UserCreateInput): Promise<User> {
  return await CreateUserAction.create(loggedOutViewer, input).saveX();
}

test("self contact query", async () => {
  let user = await create({
    firstName: "Jon",
    lastName: "Snow",
    emailAddress: randomEmail(),
  });
  let vc = new IDViewer(user.id);
  user = await User.loadX(vc, user.id);
  let selfContact = await user.loadSelfContact();

  const selfContactsMap = await UserToSelfContactQuery.query(
    vc,
    user.id,
  ).queryEnts();
  expect(selfContactsMap.size).toBe(1);
  const contacts = selfContactsMap.get(user.id) || [];

  expect(contacts).toStrictEqual([selfContact]);
});

test("friends query", async () => {
  let dany = await create({
    firstName: "Daenerys",
    lastName: "Targaryen",
    emailAddress: randomEmail(),
  });
  let sam = await create({
    firstName: "Samwell",
    lastName: "Tarly",
    emailAddress: randomEmail(),
  });

  let action = CreateUserAction.create(loggedOutViewer, {
    firstName: "Jon",
    lastName: "Snow",
    emailAddress: randomEmail(),
  });
  let t = new Date();
  t.setTime(t.getTime() + 86400);
  action.builder.addFriend(dany).addFriendID(sam.id, {
    time: t,
  });
  const jon = await action.saveX();

  const vc = new IDViewer(jon.id);
  const query = UserToFriendsQuery.query(vc, jon.id);

  const [countMap, idsMap] = await Promise.all([
    query.queryRawCount(),
    query.queryIDs(),
  ]);

  const count = countMap.get(jon.id);
  const ids = idsMap.get(jon.id);

  expect(count).toBe(2);
  // sam more recent so always gonna come back before dany
  expect(ids).toStrictEqual([sam.id, dany.id]);
});
