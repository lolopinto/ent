import { advanceBy, advanceTo } from "jest-date-mock";
import { Viewer } from "@snowtop/ent";
import {
  expectMutation,
  expectQueryFromRoot,
  queryRootConfig,
} from "@snowtop/ent-graphql-tests";
import { clearAuthHandlers } from "@snowtop/ent/auth";
import { encodeGQLID, mustDecodeIDFromGQLID } from "@snowtop/ent/graphql";
import schema from "../generated/schema";
import CreateUserAction from "../../ent/user/actions/create_user_action";
import { Contact, User } from "../../ent";
import { randomEmail, randomPhoneNumber } from "../../util/random";
import EditUserAction from "../../ent/user/actions/edit_user_action";
import CreateContactAction from "../../ent/contact/actions/create_contact_action";
import { LoggedOutExampleViewer, ExampleViewer } from "../../viewer/viewer";
import { ContactLabel, NodeType } from "src/ent/generated/types";
import EditContactAction from "src/ent/contact/actions/edit_contact_action";
import CreateContactEmailAction from "src/ent/contact_email/actions/create_contact_email_action";
import CreateContactPhoneNumberAction from "src/ent/contact_phone_number/actions/create_contact_phone_number_action";
import CreateFileAction from "src/ent/file/actions/create_file_action";

afterEach(() => {
  clearAuthHandlers();
});

const loggedOutViewer = new LoggedOutExampleViewer();

function getConfig(
  viewer: Viewer,
  contact: Contact,
  partialConfig?: Partial<queryRootConfig>,
): queryRootConfig {
  return {
    viewer: viewer,
    schema: schema,
    root: "node",
    args: {
      id: encodeGQLID(contact),
    },
    inlineFragmentRoot: "Contact",
    ...partialConfig,
  };
}

function getUserConfig(
  viewer: Viewer,
  contact: User,
  partialConfig?: Partial<queryRootConfig>,
): queryRootConfig {
  return {
    viewer: viewer,
    schema: schema,
    root: "node",
    args: {
      id: encodeGQLID(contact),
    },
    inlineFragmentRoot: "User",
    ...partialConfig,
  };
}

async function createUser(): Promise<User> {
  return CreateUserAction.create(loggedOutViewer, {
    firstName: "Jon",
    lastName: "Snow",
    emailAddress: randomEmail(),
    phoneNumber: randomPhoneNumber(),
    password: "pa$$w0rd",
  }).saveX();
}

async function createContact(user?: User): Promise<Contact> {
  if (!user) {
    user = await createUser();
  }
  const contact = await CreateContactAction.create(new ExampleViewer(user.id), {
    emails: [
      {
        emailAddress: randomEmail(),
        label: ContactLabel.Default,
        ownerId: user.id,
      },
    ],
    firstName: "Jon",
    lastName: "Snow",
    userId: user.id,
  }).saveX();
  // reload
  return Contact.loadX(contact.viewer, contact.id);
}

test("query contact", async () => {
  let contact = await createContact();
  let user = await contact.loadUserX();
  let emails = await contact.loadEmails();

  await expectQueryFromRoot(
    getConfig(new ExampleViewer(user.id), contact),
    ["id", encodeGQLID(contact)],
    ["user.id", encodeGQLID(user)],
    ["user.firstName", contact.firstName],
    ["firstName", contact.firstName],
    ["lastName", contact.lastName],
    ["emails[0].emailAddress", emails[0].emailAddress],
  );
});

test("query contact with different viewer", async () => {
  let contact = await createContact();
  let user = await CreateUserAction.create(loggedOutViewer, {
    firstName: "Jon",
    lastName: "Snow",
    emailAddress: randomEmail(),
    phoneNumber: randomPhoneNumber(),
    password: "pa$$w0rd",
  }).saveX();

  // can't load someone else's contact
  await expectQueryFromRoot(
    getConfig(new ExampleViewer(user.id), contact, { rootQueryNull: true }),
    ["id", null],
  );
});

test("likes", async () => {
  const user = await createUser();
  const [contact1, contact2, contact3] = await Promise.all([
    createContact(user),
    createContact(user),
    createContact(user),
  ]);
  const action = EditUserAction.create(user.viewer, user, {});
  for (const contact of [contact1, contact2, contact3]) {
    advanceBy(1000);
    action.builder.addLikeID(contact.id, contact.nodeType, {
      time: new Date(),
    });
  }
  // for privacy
  await action.saveX();

  await expectQueryFromRoot(
    getConfig(new ExampleViewer(user.id), contact1),
    ["likers.rawCount", 1],
    [
      "likers.nodes",
      [
        {
          id: encodeGQLID(user),
        },
      ],
    ],
  );

  await expectQueryFromRoot(
    getUserConfig(new ExampleViewer(user.id), user),
    ["likes.rawCount", 3],
    // most recent first
    [
      "likes.nodes",
      [
        {
          id: encodeGQLID(contact3),
        },
        {
          id: encodeGQLID(contact2),
        },
        {
          id: encodeGQLID(contact1),
        },
      ],
    ],
  );
});

test("custom object added in contact", async () => {
  let contact = await createContact();
  let user = await contact.loadUserX();
  let emails = await contact.loadEmails();
  expect(emails.length).toBe(1);
  const email1 = emails[0];
  const email2 = await CreateContactEmailAction.create(contact.viewer, {
    emailAddress: randomEmail(),
    label: ContactLabel.Home,
    contactId: contact.id,
    ownerId: user.id,
  }).saveX();

  await EditContactAction.create(contact.viewer, contact, {
    emailIds: [email1.id, email2.id],
  }).saveX();

  await expectQueryFromRoot(
    getConfig(new ExampleViewer(user.id), contact),
    ["id", encodeGQLID(contact)],
    ["plusEmails.emails[0].id", encodeGQLID(email1)],
    ["plusEmails.emails[1].id", encodeGQLID(email2)],
    ["plusEmails.firstEmail", email1.emailAddress],
  );
});

test("edit contact with new email ids", async () => {
  let contact = await createContact();
  let emails = await contact.loadEmails();
  expect(emails.length).toBe(1);
  const email1 = emails[0];
  const email2 = await CreateContactEmailAction.create(contact.viewer, {
    emailAddress: randomEmail(),
    label: ContactLabel.Home,
    contactId: contact.id,
    ownerId: contact.userId,
  }).saveX();

  await expectMutation(
    {
      mutation: "contactEdit",
      viewer: contact.viewer,
      schema,
      args: {
        id: encodeGQLID(contact),
        emailIds: [encodeGQLID(email1), encodeGQLID(email2)],
      },
    },
    ["contact.id", encodeGQLID(contact)],
    ["contact.emails[0].id", encodeGQLID(email1)],
    ["contact.emails[1].id", encodeGQLID(email2)],
  );
});

test("edit contact with new phone number ids", async () => {
  let contact = await createContact();
  let phoneNumbers = await contact.loadPhoneNumbers();
  expect(phoneNumbers.length).toBe(0);
  const [phone1, phone2] = await Promise.all([
    CreateContactPhoneNumberAction.create(contact.viewer, {
      phoneNumber: randomPhoneNumber(),
      label: ContactLabel.Home,
      contactId: contact.id,
      ownerId: contact.userId,
    }).saveX(),
    CreateContactPhoneNumberAction.create(contact.viewer, {
      phoneNumber: randomPhoneNumber(),
      label: ContactLabel.Home,
      contactId: contact.id,
      ownerId: contact.userId,
    }).saveX(),
  ]);

  await expectMutation(
    {
      mutation: "contactEdit",
      viewer: contact.viewer,
      schema,
      args: {
        id: encodeGQLID(contact),
        phoneNumberIds: [encodeGQLID(phone1), encodeGQLID(phone2)],
      },
    },
    ["contact.id", encodeGQLID(contact)],
    ["contact.phoneNumbers[0].id", encodeGQLID(phone1)],
    ["contact.phoneNumbers[1].id", encodeGQLID(phone2)],
  );
});

test("canViewerDo", async () => {
  const contact = await createContact();
  const emails = await contact.loadEmails();
  expect(emails.length).toBe(1);

  await expectQueryFromRoot(
    {
      viewer: contact.viewer,
      schema: schema,
      root: "node",
      args: {
        id: encodeGQLID(emails[0]),
      },
      inlineFragmentRoot: "ContactEmail",
    },
    ["canViewerDo.contactEmailEdit", true],
  );
});

test("global canViewerDo", async () => {
  const user = await createUser();
  const user2 = await createUser();

  const contact = await createContact(user);
  const contact2 = await createContact(user2);

  await expectQueryFromRoot(
    {
      schema: schema,
      viewer: user.viewer,
      root: "can_viewer_do",
      args: {},
    },
    [
      `contactCreateSelf: contactCreate(userId: "${encodeGQLID(user)}")`,
      true,
      "contactCreateSelf",
    ],
    [
      `contactCreateOther: contactCreate(userId: "${encodeGQLID(user2)}")`,
      false,
      "contactCreateOther",
    ],
    // can create email with given contact
    [
      `contactEmailCreateSelf: contactEmailCreate(contactId: "${encodeGQLID(
        contact,
      )}" emailAddress: "${randomEmail(
        "hello",
      )}" label: HOME, ownerId: "${encodeGQLID(user)}")`,
      true,
      "contactEmailCreateSelf",
    ],
    // cannot create email with given contact
    [
      `contactEmailCreateOther: contactEmailCreate(contactId: "${encodeGQLID(
        contact2,
      )}" emailAddress: "${randomEmail(
        "hello",
      )}" label: HOME, ownerId: "${encodeGQLID(user2)}")`,
      false,
      "contactEmailCreateOther",
    ],
  );
});

test("create contact with attachments", async () => {
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

  const email = randomEmail();

  await expectMutation(
    {
      mutation: "contactCreate",
      viewer: user.viewer,
      schema,
      args: {
        firstName: "Jon",
        lastName: "Snow",
        userId: encodeGQLID(user),
        emails: [
          {
            emailAddress: email,
            label: ContactLabel.Home.toUpperCase(),
            ownerId: encodeGQLID(user),
          },
        ],
        attachments: [
          {
            fileId: encodeGQLID(file),
            note: "note",
            date: d.toISOString(),
            dupeFileId: encodeGQLID(file),
            creatorId: encodeGQLID(user),
            creatorType: "User",
          },
          {
            fileId: encodeGQLID(file2),
            note: "note2",
            date: d.toISOString(),
            dupeFileId: encodeGQLID(file2),
          },
        ],
      },
    },
    [
      "contact.id",
      async function name(id: string) {
        const entId = mustDecodeIDFromGQLID(id);
        const contact = await Contact.loadX(user.viewer, entId);
        expect(contact.attachments).toHaveLength(2);
        expect(contact.attachments?.[0].creatorType).toBe(NodeType.User);
      },
    ],
    ["contact.firstName", "Jon"],
    ["contact.lastName", "Snow"],
    ["contact.emails[0].emailAddress", email],
    ["contact.attachments[0].file.id", encodeGQLID(file)],
    ["contact.attachments[0].dupeFile.id", encodeGQLID(file)],
    ["contact.attachments[0].note", "note"],
    ["contact.attachments[0].creator.id", encodeGQLID(user)],
    // TODO we should have a way to query nested graphql fragments...
    // ["contact.attachments[0].creator....on User.type", "User"],
    ["contact.attachments[1].dupeFile.id", encodeGQLID(file2)],
    ["contact.attachments[1].file.id", encodeGQLID(file2)],
    ["contact.attachments[1].note", "note2"],
  );
});
