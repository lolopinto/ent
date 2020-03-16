import User, { createUser, UserCreateInput } from "src/ent/user";

import Contact, { createContact, ContactCreateInput } from "src/ent/contact";
import DB from "ent/db";
import { LogedOutViewer } from "ent/viewer";
import { ID, Ent, Viewer, loadEntsFromClause } from "ent/ent";
import * as query from "ent/query";

const loggedOutViewer = new LogedOutViewer();

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
  let user = await createUser(loggedOutViewer, {
    firstName: "Jon",
    lastName: "Snow",
  });
  if (user == null) {
    fail("could not create user");
  }
  function random(): string {
    return Math.random()
      .toString(16)
      .substring(2);
  }
  let contact = await createContact(loggedOutViewer, {
    emailAddress: `test+${random()}@email.com`,
    firstName: firstName,
    lastName: lastName,
    userID: user.id as string,
  });
  if (contact == null) {
    fail("could not create contact");
  }
  return contact;
}

async function createMany(
  names: Pick<ContactCreateInput, "firstName" | "lastName">[],
): Promise<Contact[]> {
  let user = await createUser(loggedOutViewer, {
    firstName: "Jon",
    lastName: "Snow",
  });
  if (user == null) {
    fail("could not create user");
  }
  function random(): string {
    return Math.random()
      .toString(16)
      .substring(2);
  }
  let results: Contact[] = [];
  for (const name of names) {
    let contact = await createContact(loggedOutViewer, {
      emailAddress: `test+${random()}@email.com`,
      firstName: name.firstName,
      lastName: name.lastName,
      userID: user.id as string,
    });
    if (contact == null) {
      fail("could not create contact");
    }
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
  const user = await User.loadX(new IDViewer(userId), userId);
  expect(user).toBeInstanceOf(User);

  // viewer can load their own contacts
  const loadedContacts = await loadEntsFromClause(
    user.viewer,
    query.Eq("user_id", userId),
    Contact.loaderOptions(),
  );
  verifyContacts(loadedContacts);

  // ramsay can't see jon snow's contacts
  let ramsay = await createUser(loggedOutViewer, {
    firstName: "Ramsay",
    lastName: "Bolton",
  });
  expect(ramsay).not.toBe(null);

  const contactsViaRamsay = await loadEntsFromClause(
    new IDViewer(ramsay!.id),
    query.Eq("user_id", userId),
    Contact.loaderOptions(),
  );
  expect(contactsViaRamsay.length).toBe(0);
});
