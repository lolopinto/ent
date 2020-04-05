import User from "src/ent/user";

import Contact from "src/ent/contact";
import DB from "ent/db";
import { LoggedOutViewer } from "ent/viewer";
import { ID, Ent, Viewer } from "ent/ent";
import { randomEmail } from "src/util/random";
import CreateUserAction from "src/ent/user/actions/create_user_action";
import CreateContactAction, {
  ContactCreateInput,
} from "src/ent/contact/actions/create_contact_action";

const loggedOutViewer = new LoggedOutViewer();

class IDViewer implements Viewer {
  constructor(public viewerID: ID, private ent: Ent | null = null) {}
  async viewer() {
    return this.ent;
  }
  instanceKey(): string {
    return `idViewer: ${this.viewerID}`;
  }
}

// TODO we need something that does this by default for all tests
afterAll(async () => {
  await DB.getInstance().endPool();
});

async function create(firstName: string, lastName: string): Promise<Contact> {
  let user = await CreateUserAction.create(loggedOutViewer, {
    firstName: "Jon",
    lastName: "Snow",
    emailAddress: randomEmail(),
  }).saveX();

  return await CreateContactAction.create(loggedOutViewer, {
    emailAddress: randomEmail(),
    firstName: firstName,
    lastName: lastName,
    userID: user.id as string,
  }).saveX();
}

async function createMany(
  names: Pick<ContactCreateInput, "firstName" | "lastName">[],
): Promise<Contact[]> {
  let user = await CreateUserAction.create(loggedOutViewer, {
    firstName: "Jon",
    lastName: "Snow",
    emailAddress: randomEmail(),
  }).saveX();
  let results: Contact[] = [];
  for (const name of names) {
    // TODO eventually a multi-create API
    let contact = await CreateContactAction.create(loggedOutViewer, {
      emailAddress: randomEmail(),
      firstName: name.firstName,
      lastName: name.lastName,
      userID: user.id as string,
    }).saveX();
    results.push(contact);
  }

  return results;
}

test("create contact", async () => {
  const contact = await create("Sansa", "Stark");

  expect(contact).toBeInstanceOf(Contact);
  expect(contact.firstName).toBe("Sansa");
  expect(contact.lastName).toBe("Stark");
});

test("create contacts", async () => {
  function verifyContacts(contacts: Contact[]) {
    expect(contacts.length).toBe(5);
    let idx = 0;
    for (const input of inputs) {
      let contact = contacts[idx];
      expect(contact.firstName).toBe(input.firstName);
      expect(contact.lastName).toBe(input.lastName);
      idx++;
    }
  }
  const inputs = [
    { firstName: "Robb", lastName: "Stark" },
    { firstName: "Sansa", lastName: "Stark" },
    { firstName: "Arya", lastName: "Stark" },
    { firstName: "Bran", lastName: "Stark" },
    { firstName: "Rickon", lastName: "Stark" },
  ];
  const contacts = await createMany(inputs);
  verifyContacts(contacts);

  const userId = contacts[0].userID;
  const v = new IDViewer(userId);
  const loadedContact = await Contact.loadX(v, contacts[0].id);
  const user = await loadedContact.loadUserX();
  expect(user).toBeInstanceOf(User);

  // viewer can load their own contacts
  const loadedContacts = await user.loadContacts();
  verifyContacts(loadedContacts);

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
