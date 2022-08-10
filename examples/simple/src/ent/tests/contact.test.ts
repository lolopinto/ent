import { User, Contact } from "../../ent";
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

const loggedOutViewer = new LoggedOutExampleViewer();

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
  return await CreateContactAction.create(new ExampleViewer(user.id), {
    emails: [
      {
        emailAddress: randomEmail(),
        label: "default",
      },
    ],
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
    let contact = await CreateContactAction.create(new ExampleViewer(user.id), {
      emails: [
        {
          emailAddress: randomEmail(),
          label: "default",
        },
      ],
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
        label: "default",
      },
      {
        emailAddress: randomEmail(),
        label: "work",
      },
    ],
    firstName: "Jon",
    lastName: "Snow",
    userID: user.id,
  };
  let contact = await CreateContactAction.create(
    new ExampleViewer(user.id),
    input,
  ).saveX();

  interface emailInfo {
    emailAddress: string;
    label: string;
  }
  const emails = await contact.loadEmails();
  const sortFn = (a: emailInfo, b: emailInfo) =>
    a.emailAddress < b.emailAddress ? -1 : 1;
  expect(input.emails.sort(sortFn)).toStrictEqual(
    emails
      .map((email) => {
        return {
          emailAddress: email.emailAddress,
          label: email.label,
        };
      })
      .sort(sortFn),
  );

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
});

test("multiple phonenumbers", async () => {
  const user = await createUser();
  const input = {
    phoneNumbers: [
      {
        phoneNumber: randomPhoneNumber(),
        label: "default",
      },
      {
        phoneNumber: randomPhoneNumber(),
        label: "work",
      },
    ],
    firstName: "Jon",
    lastName: "Snow",
    userID: user.id,
  };
  let contact = await CreateContactAction.create(
    new ExampleViewer(user.id),
    input,
  ).saveX();
  interface phoneNmberInfo {
    phoneNumber: string;
    label: string;
  }
  const sortFn = (a: phoneNmberInfo, b: phoneNmberInfo) =>
    a.phoneNumber < b.phoneNumber ? -1 : 1;

  const phoneNumbers = await contact.loadPhoneNumbers();
  expect(input.phoneNumbers.sort(sortFn)).toStrictEqual(
    phoneNumbers
      .map((phoneNumber) => {
        return {
          phoneNumber: phoneNumber.phoneNumber,
          label: phoneNumber.label,
        };
      })
      .sort(sortFn),
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
