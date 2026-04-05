import { User, Contact, ContactEmail } from "../../ent";
import { randomEmail, randomPhoneNumber } from "../../util/random";
import CreateUserAction from "../user/actions/create_user_action";
import CreateContactAction, {
  ContactCreateInput,
} from "../contact/actions/create_contact_action";
import { UserToContactsQuery } from "../user/query/user_to_contacts_query";
import EditContactAction from "../contact/actions/edit_contact_action";
import { LoggedOutExampleViewer, ExampleViewer } from "../../viewer/viewer";
import { query } from "@snowtop/ent";
import { v4 } from "uuid";
import { ContactLabel, ContactInfoSource, NodeType } from "../generated/types";
import { Transaction } from "@snowtop/ent/action";
import CreateFileAction from "../file/actions/create_file_action";
import { advanceTo } from "jest-date-mock";

const loggedOutViewer = new LoggedOutExampleViewer();

async function createUser(): Promise<User> {
  return CreateUserAction.create(loggedOutViewer, {
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
  partial?: Partial<ContactCreateInput>,
): Promise<Contact> {
  return CreateContactAction.create(new ExampleViewer(user.id), {
    emails: [
      {
        emailAddress: randomEmail(),
        label: ContactLabel.Default,
        ownerId: user.id,
      },
    ],
    firstName: firstName,
    lastName: lastName,
    userId: user.id,
    ...partial,
  }).saveX();
}

async function createMany(
  user: User,
  names: Pick<ContactCreateInput, "firstName" | "lastName">[],
): Promise<Contact[]> {
  let results: Contact[] = [];
  for (const name of names) {
    // TODO eventually a multi-create API
    const contact = await CreateContactAction.create(
      new ExampleViewer(user.id),
      {
        emails: [
          {
            emailAddress: randomEmail(),
            label: ContactLabel.Default,
            ownerId: user.id,
          },
        ],
        firstName: name.firstName,
        lastName: name.lastName,
        userId: user.id,
      },
    ).saveX();
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

test("create contact with explicit empty attachments", async () => {
  let user = await createUser();
  const contact = await create(user, "Sansa", "Stark", {
    attachments: [],
  });

  expect(contact).toBeInstanceOf(Contact);
  expect(contact.firstName).toBe("Sansa");
  expect(contact.lastName).toBe("Stark");
  expect(contact.attachments).toStrictEqual([]);
});

test("create contact with explicit attachments", async () => {
  let user = await createUser();
  const file = await CreateFileAction.create(user.viewer, {
    creatorId: user.id,
    name: "test.png",
    path: "/tmp/test.png",
  }).saveX();
  const file2 = await CreateFileAction.create(user.viewer, {
    creatorId: user.id,
    name: "test.png2",
    path: "/tmp/test.png2",
  }).saveX();
  const d = new Date();
  advanceTo(d);
  const contact = await create(user, "Sansa", "Stark", {
    attachments: [
      {
        fileId: file.id,
        date: d,
        note: "test",
        dupeFileId: file.id,
        creatorId: user.id,
        creatorType: NodeType.User,
      },
      {
        fileId: file2.id,
        date: d,
        note: "test",
        dupeFileId: file2.id,
      },
    ],
  });

  expect(contact).toBeInstanceOf(Contact);
  expect(contact.firstName).toBe("Sansa");
  expect(contact.lastName).toBe("Stark");
  expect(contact.attachments).toMatchObject([
    {
      fileId: file.id,
      date: d.toISOString(),
      note: "test",
      dupeFileId: file.id,
      creatorId: user.id,
      creatorType: NodeType.User,
    },
    {
      fileId: file2.id,
      date: d.toISOString(),
      note: "test",
      dupeFileId: file2.id,
    },
  ]);
});

test("create contact with important dates struct", async () => {
  const user = await createUser();
  const firstMet = new Date(Date.UTC(2022, 5, 15));
  const lastSpoken = new Date(Date.UTC(2023, 0, 1));
  const firstMetStr = firstMet.toISOString().slice(0, 10);
  const lastSpokenStr = lastSpoken.toISOString().slice(0, 10);

  const contact = await create(user, "Brienne", "Tarth", {
    importantDates: {
      firstMet: firstMetStr,
      lastSpoken: lastSpokenStr,
    },
  });

  expect(contact.importantDates).toEqual({
    firstMet: firstMetStr,
    lastSpoken: lastSpokenStr,
  });
});

test("edit contact with important dates strings", async () => {
  const user = await createUser();
  let contact = await create(user, "Jaime", "Lannister");
  const viewer = new ExampleViewer(user.id);

  contact = await EditContactAction.create(viewer, contact, {
    importantDates: {
      firstMet: "2010-10-10",
      lastSpoken: null,
    },
  }).saveX();

  expect(contact.importantDates).toEqual({
    firstMet: "2010-10-10",
    lastSpoken: null,
  });

  const reloaded = await Contact.loadX(viewer, contact.id);
  expect(reloaded.importantDates).toEqual({
    firstMet: "2010-10-10",
    lastSpoken: null,
  });
});

test("create contacts", async () => {
  function verifyContacts(
    contacts: Contact[],
    inputs: Pick<ContactCreateInput, "firstName" | "lastName">[],
  ) {
    expect(contacts.length).toBe(inputs.length);
    // order is not always as expected so just sort them
    contacts.sort((a, b) => a.firstName.localeCompare(b.firstName));
    inputs.sort((a, b) => a.firstName.localeCompare(b.firstName));
    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      const contact = contacts[i];
      expect(contact.firstName, `${i}`).toBe(input.firstName);
      expect(contact.lastName, `${i}`).toBe(input.lastName);
    }
  }
  const inputs = [
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

  const userId = contacts[0].userId;
  const v = new ExampleViewer(userId);
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
  const action = CreateUserAction.create(loggedOutViewer, {
    firstName: "Ygritte",
    lastName: "",
    emailAddress: randomEmail(),
    phoneNumber: randomPhoneNumber(),
    password: "pa$$w0rd",
  });
  action.builder.addFriend(user);
  const ygritte = await action.saveX();

  // ygritte can load jon (because they are friends) but not his contacts
  let jonFromYgritte = await User.loadX(
    new ExampleViewer(ygritte!.id),
    user.id,
  );
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

test("multiple emails", async () => {
  const user = await createUser();
  const input = {
    emails: [
      {
        emailAddress: randomEmail(),
        label: ContactLabel.Default,
        extra: {
          default: true,
          source: ContactInfoSource.Online,
        },
        ownerId: user.id,
      },
      {
        emailAddress: randomEmail(),
        label: ContactLabel.Work,
        ownerId: user.id,
        // set to make test easier
        extra: null,
      },
    ],
    firstName: "Jon",
    lastName: "Snow",
    userId: user.id,
  };
  let contact = await CreateContactAction.create(
    new ExampleViewer(user.id),
    input,
  ).saveX();

  interface emailInfo {
    emailAddress: string;
    label: ContactLabel;
    extra?: any;
  }
  const emails = await contact.loadEmails();
  const sortFn = (a: emailInfo, b: emailInfo) =>
    a.emailAddress < b.emailAddress ? -1 : 1;
  const emailsInfo = await Promise.all(
    emails.map(async (email) => {
      return {
        emailAddress: email.emailAddress,
        label: email.label,
        extra: await email.extra(),
        ownerId: email.ownerId,
      };
    }),
  );
  expect(input.emails.sort(sortFn)).toStrictEqual(emailsInfo.sort(sortFn));

  const r = await Contact.loadCustom(
    contact.viewer,
    query.PostgresArrayContainsValue("email_ids", emails[0].id),
  );
  expect(r.length).toBe(1);
  expect(r[0].id).toBe(contact.id);
  const r2 = await Contact.loadCustom(
    contact.viewer,
    query.PostgresArrayContains(
      "email_ids",
      emails.map((email) => email.id),
    ),
  );
  expect(r2.length).toBe(1);
  expect(r2[0].id).toBe(contact.id);

  const r3 = await Contact.loadCustom(
    contact.viewer,
    query.PostgresArrayOverlaps("email_ids", [
      ...emails.map((email) => email.id),
      v4(),
    ]),
  );
  expect(r3.length).toBe(1);
  expect(r3[0].id).toBe(contact.id);

  const email1 = emails[0];
  const newEmail = randomEmail();
  const editedContact = await EditContactAction.create(
    contact.viewer,
    contact,
    {
      firstName: "Aegon",
      lastName: "Targaryen",
      emails: [
        {
          id: email1.id,
          emailAddress: newEmail,
        },
      ],
    },
  ).saveX();
  expect(editedContact.firstName).toBe("Aegon");
  expect(editedContact.lastName).toBe("Targaryen");

  const email1Reloaded = await ContactEmail.loadX(contact.viewer, email1.id);
  expect(email1Reloaded.emailAddress).toBe(newEmail);
});

test("email_ids inverse edge updates", async () => {
  const user = await createUser();
  const contact = await CreateContactAction.create(new ExampleViewer(user.id), {
    emails: [
      {
        emailAddress: randomEmail(),
        label: ContactLabel.Default,
        ownerId: user.id,
      },
      {
        emailAddress: randomEmail(),
        label: ContactLabel.Work,
        ownerId: user.id,
      },
    ],
    firstName: "Arya",
    lastName: "Stark",
    userId: user.id,
  }).saveX();

  const emails = await contact.loadEmails();
  expect(emails.length).toBe(2);
  const email1 = emails[0];
  const email2 = emails[1];

  const email1Loaded = await ContactEmail.loadX(contact.viewer, email1.id);
  const email2Loaded = await ContactEmail.loadX(contact.viewer, email2.id);

  const [email1Contacts, email2Contacts] = await Promise.all([
    email1Loaded.queryEmailsForContacts().queryEnts(),
    email2Loaded.queryEmailsForContacts().queryEnts(),
  ]);
  expect(email1Contacts.length).toBe(1);
  expect(email2Contacts.length).toBe(1);
  expect(email1Contacts[0].id).toBe(contact.id);
  expect(email2Contacts[0].id).toBe(contact.id);

  await EditContactAction.create(contact.viewer, contact, {
    emailIds: [email1.id],
  }).saveX();

  const email2Reloaded = await ContactEmail.loadX(contact.viewer, email2.id);
  const [email1ContactsAfter, email2ContactsAfter] = await Promise.all([
    email1Loaded.queryEmailsForContacts().queryEnts(),
    email2Reloaded.queryEmailsForContacts().queryEnts(),
  ]);
  expect(email1ContactsAfter.length).toBe(1);
  expect(email1ContactsAfter[0].id).toBe(contact.id);
  expect(email2ContactsAfter.length).toBe(0);
});

test("multiple phonenumbers", async () => {
  const user = await createUser();
  const input = {
    phoneNumbers: [
      {
        phoneNumber: randomPhoneNumber(),
        label: ContactLabel.Default,
        ownerId: user.id,
        extra: {
          default: true,
          source: ContactInfoSource.Friend,
        },
      },
      {
        phoneNumber: randomPhoneNumber(),
        label: ContactLabel.Default,
        ownerId: user.id,
        extra: null,
      },
    ],
    firstName: "Jon",
    lastName: "Snow",
    userId: user.id,
  };
  let contact = await CreateContactAction.create(
    new ExampleViewer(user.id),
    input,
  ).saveX();
  interface phoneNmberInfo {
    phoneNumber: string;
    label: ContactLabel;
    extra?: any;
  }
  const sortFn = (a: phoneNmberInfo, b: phoneNmberInfo) =>
    a.phoneNumber < b.phoneNumber ? -1 : 1;

  const phoneNumbers = await contact.loadPhoneNumbers();
  const phoneNumbersInfo = await Promise.all(
    phoneNumbers.map(async (phoneNumber) => {
      return {
        phoneNumber: phoneNumber.phoneNumber,
        label: phoneNumber.label,
        extra: await phoneNumber.extra(),
        ownerId: phoneNumber.ownerId,
      };
    }),
  );
  expect(input.phoneNumbers.sort(sortFn)).toStrictEqual(
    phoneNumbersInfo.sort(sortFn),
  );

  const r = await Contact.loadCustom(
    contact.viewer,
    query.PostgresArrayContainsValue("phone_number_ids", phoneNumbers[0].id),
  );
  expect(r.length).toBe(1);
  expect(r[0].id).toBe(contact.id);
  const r2 = await Contact.loadCustom(
    contact.viewer,
    query.PostgresArrayContains(
      "phone_number_ids",
      phoneNumbers.map((p) => p.id),
    ),
  );
  expect(r2.length).toBe(1);
  expect(r2[0].id).toBe(contact.id);

  const r3 = await Contact.loadCustom(
    contact.viewer,
    query.PostgresArrayOverlaps("phone_number_ids", [
      ...phoneNumbers.map((p) => p.id),
      v4(),
    ]),
  );
  expect(r3.length).toBe(1);
  expect(r3[0].id).toBe(contact.id);
});

test("transaction with different viewer type", async () => {
  const user = await createUser();

  const ct = await user.queryContacts().queryCount();
  expect(ct).toBe(1);

  const viewer = new ExampleViewer(user.id);
  const action1 = CreateContactAction.create(viewer, {
    firstName: "Jon",
    lastName: "Snow",
    userId: user.id,
  });
  const action2 = CreateContactAction.create(viewer, {
    firstName: "Jon",
    lastName: "Snow",
    userId: user.id,
  });

  const tx = new Transaction(viewer, [action1, action2]);
  await tx.run();

  const ct2 = await user.queryContacts().queryCount();
  expect(ct2).toBe(3);
});
