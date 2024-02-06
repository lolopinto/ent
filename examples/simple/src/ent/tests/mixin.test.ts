import { User, Contact, Event, isFeedback } from "../../ent";
import { randomEmail, randomPhoneNumber } from "../../util/random";
import CreateUserAction from "../user/actions/create_user_action";
import CreateContactAction, {
  ContactCreateInput,
} from "../contact/actions/create_contact_action";
import { LoggedOutExampleViewer, ExampleViewer } from "../../viewer/viewer";
import { ContactLabel } from "../generated/types";
import CreateEventAction, {
  EventCreateInput,
} from "../event/actions/create_event_action";

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

async function createContact(
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
      },
    ],
    firstName: firstName,
    lastName: lastName,
    userID: user.id,
    ...partial,
  }).saveX();
}

async function createEvent(
  startTime: Date,
  partial?: Partial<EventCreateInput>,
): Promise<Event> {
  let user = await createUser();

  return CreateEventAction.create(loggedOutViewer, {
    name: "fun event",
    creatorID: user.id,
    startTime: startTime,
    location: "location",
    ...partial,
  }).saveX();
}

test("feedback user", async () => {
  const user = await createUser();
  expect(isFeedback(user)).toBe(true);
  expect(await user.hasLikers()).toBe(false);
});

test("feedback contact", async () => {
  const user = await createUser();
  const contact = await createContact(user, "Jon", "Snow");
  expect(isFeedback(contact)).toBe(true);
  expect(await user.hasLikers()).toBe(false);
});

test("feedback event", async () => {
  const event = await createEvent(new Date());
  expect(isFeedback(event)).toBe(false);
  // can't call hasLikers on event
  // expect(await event.hasLikers()).toBe(false);
});
