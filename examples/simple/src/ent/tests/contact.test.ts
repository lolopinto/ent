import { DB, LoggedOutViewer, IDViewer } from "@snowtop/ent";
import { User, Contact } from "../../ent";
import { randomEmail, randomPhoneNumber } from "../../util/random";
import CreateUserAction from "../user/actions/create_user_action";
import CreateContactAction, {
  ContactCreateInput,
} from "../contact/actions/create_contact_action";
import { UserToContactsQuery } from "../user/query/user_to_contacts_query";
import EditContactAction from "../contact/actions/edit_contact_action";

const loggedOutViewer = new LoggedOutViewer();

// TODO we need something that does this by default for all tests
afterAll(async () => {
  await DB.getInstance().endPool();
});

async function createUser(): Promise<User> {
  return await CreateUserAction.create(loggedOutViewer, {
    firstName: "Jon",
    lastName: "Snow",
    emailAddress: randomEmail(),
    phoneNumber: randomPhoneNumber(),
    password: "pa$$w0rd",
  }).saveX();
}

async function create(
  user: User,
  firstName: string,
  lastName: string,
): Promise<Contact> {
  return await CreateContactAction.create(new IDViewer(user.id), {
    emailAddress: randomEmail(),
    firstName: firstName,
    lastName: lastName,
    userID: user.id,
  }).saveX();
}

async function createMany(
  user: User,
  names: Pick<ContactCreateInput, "firstName" | "lastName">[],
): Promise<Contact[]> {
  let results: Contact[] = [];
  for (const name of names) {
    // TODO eventually a multi-create API
    let contact = await CreateContactAction.create(new IDViewer(user.id), {
      emailAddress: randomEmail(),
      firstName: name.firstName,
      lastName: name.lastName,
      userID: user.id,
    }).saveX();
    results.push(contact);
  }

  return results;
}

test("create contact", async () => {
  let user = await createUser();
  const contact = await create(user, "Sansa", "Stark");

  expect(contact).toBeInstanceOf(Contact);
  expect(contact.firstName).toBe("Sansa");
  expect(contact.lastName).toBe("Stark");
});

test("create contacts", async () => {
  function verifyContacts(
    contacts: Contact[],
    inputs: Pick<ContactCreateInput, "firstName" | "lastName">[],
  ) {
    expect(contacts.length).toBe(inputs.length);
    let idx = 0;
    for (const input of inputs) {
      let contact = contacts[idx];
      expect(contact.firstName).toBe(input.firstName);
      expect(contact.lastName).toBe(input.lastName);
      idx++;
    }
  }
  let inputs = [
    { firstName: "Robb", lastName: "Stark" },
    { firstName: "Sansa", lastName: "Stark" },
    { firstName: "Arya", lastName: "Stark" },
    { firstName: "Bran", lastName: "Stark" },
    { firstName: "Rickon", lastName: "Stark" },
  ];
  let user = await createUser();
  const contacts = await createMany(user, inputs);
  // it'll be in the initial order because it's in order of creation
  verifyContacts(contacts, inputs);

  const userId = contacts[0].userID;
  const v = new IDViewer(userId);
  const loadedContact = await Contact.loadX(v, contacts[0].id);
  user = await loadedContact.loadUserX();
  expect(user).toBeInstanceOf(User);

  // viewer can load their own contacts
  const loadedContacts = await UserToContactsQuery.query(
    user.viewer,
    user,
  ).queryEnts();
  // we're using entquery so the order is reversed (from most recently created to first created)
  let inputs2 = inputs.reverse();
  // include the self created contact from account creation
  inputs2.push({ firstName: "Jon", lastName: "Snow" });

  verifyContacts(loadedContacts, inputs2);

  // ygritte can't see jon snow's contacts
  let action = CreateUserAction.create(loggedOutViewer, {
    firstName: "Ygritte",
    lastName: "",
    emailAddress: randomEmail(),
    phoneNumber: randomPhoneNumber(),
    password: "pa$$w0rd",
  });
  action.builder.addFriend(user);
  const ygritte = await action.saveX();

  // ygritte can load jon (because they are friends) but not his contacts
  let jonFromYgritte = await User.loadX(new IDViewer(ygritte!.id), user.id);
  const contactsViaYgritte = await jonFromYgritte.queryContacts().queryEnts();
  expect(contactsViaYgritte.length).toBe(0);
});

test("likes", async () => {
  const user = await createUser();
  const contact = await create(user, "Tom", "Hardy");
  const action = EditContactAction.create(user.viewer, contact, {});
  action.builder.addLiker(user);
  await action.saveX();

  const likersQuery = contact.queryLikers();
  const [count, ents] = await Promise.all([
    likersQuery.queryCount(),
    likersQuery.queryEnts(),
  ]);
  expect(count).toBe(1);
  expect(ents.length).toBe(1);
  expect(ents[0].id).toBe(user.id);

  const likesQuery = user.queryLikes();
  const [count2, ents2] = await Promise.all([
    likesQuery.queryCount(),
    likesQuery.queryEnts(),
  ]);
  expect(count2).toBe(1);
  expect(ents2.length).toBe(1);
  expect(ents2[0].id).toBe(contact.id);
});
