import User from "src/ent/user";
import Contact from "src/ent/contact";
import { DB, LoggedOutViewer, IDViewer } from "@lolopinto/ent";
import { randomEmail } from "src/util/random";
import CreateUserAction from "src/ent/user/actions/create_user_action";
import CreateContactAction, {
  ContactCreateInput,
} from "src/ent/contact/actions/create_contact_action";

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
  }).saveX();
}

async function create(
  user: User,
  firstName: string,
  lastName: string,
): Promise<Contact> {
  return await CreateContactAction.create(loggedOutViewer, {
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
    let contact = await CreateContactAction.create(loggedOutViewer, {
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
  function verifyContacts(contacts: Contact[], includeSelf: boolean = false) {
    let expLength = 5;
    if (includeSelf) {
      expLength++;
      // include the self created contact from account creation
      inputs.unshift({ firstName: "Jon", lastName: "Snow" });
    }
    expect(contacts.length).toBe(expLength);
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
  verifyContacts(contacts);

  const userId = contacts[0].userID;
  const v = new IDViewer(userId);
  const loadedContact = await Contact.loadX(v, contacts[0].id);
  user = await loadedContact.loadUserX();
  expect(user).toBeInstanceOf(User);

  // viewer can load their own contacts
  const loadedContacts = await user.loadContacts();
  verifyContacts(loadedContacts, true);

  // ygritte can't see jon snow's contacts
  let action = CreateUserAction.create(loggedOutViewer, {
    firstName: "Ygritte",
    lastName: "",
    emailAddress: randomEmail(),
  });
  action.builder.addFriend(user);
  const ygritte = await action.saveX();

  // ygritte can load jon (because they are friends) but not his contacts
  let jonFromYgritte = await User.loadX(new IDViewer(ygritte!.id), user.id);
  const contactsViaYgritte = await jonFromYgritte.loadContacts();
  expect(contactsViaYgritte.length).toBe(0);
});
