import { fail } from "assert";
import { advanceBy, advanceTo } from "jest-date-mock";
import { IDViewer, LoggedOutViewer } from "../../core/viewer";
import { Data, Ent } from "../../core/base";
import { AssocEdge, loadEdgeData } from "../../core/ent";
import { snakeCase } from "snake-case";
import { createRowForTest } from "../write";
import {
  TempDB,
  assoc_edge_config_table,
  assoc_edge_table,
} from "../db/test_db";

import {
  createUser,
  FakeUser,
  UserCreateInput,
  ContactCreateInput,
  FakeContact,
  getContactBuilder,
  EdgeType,
  SymmetricEdges,
  InverseEdges,
  FakeUserSchema,
} from ".";
import { EventCreateInput, FakeEvent, getEventBuilder } from "./fake_event";
import { NodeType } from "./const";
import { MockDate } from "./../mock_date";
import { BuilderSchema, SimpleAction } from "../builder";
import { WriteOperation } from "../../action";

export function getContactInput(
  user: FakeUser,
  input?: Partial<ContactCreateInput>,
): ContactCreateInput {
  return {
    firstName: "Jon",
    lastName: "Snow",
    emailAddress: "foo@bar.com",
    userID: user.id,
    ...input,
  };
}

export function getUserInput(
  input?: Partial<UserCreateInput>,
): UserCreateInput {
  return {
    firstName: "Jon",
    lastName: "Snow",
    emailAddress: "foo@bar.com",
    phoneNumber: "415-212-1212",
    password: "pa$$w0rd",
    ...input,
  };
}

export function getEventInput(
  user: FakeUser,
  input?: Partial<EventCreateInput>,
): EventCreateInput {
  return {
    startTime: new Date(),
    location: "fun location",
    title: "title",
    description: "fun event",
    userID: user.id,
    ...input,
  };
}

export async function createTestUser(
  input?: Partial<UserCreateInput>,
): Promise<FakeUser> {
  const user = await createUser(new LoggedOutViewer(), {
    firstName: "Jon",
    lastName: "Snow",
    password: "12345678",
    phoneNumber: "4152221231",
    emailAddress: "foo@bar.com",
    ...input,
  });
  if (!user) {
    fail("error creating user");
  }
  return user;
}

export const inputs: Partial<ContactCreateInput>[] = [
  {
    firstName: "Arya",
    lastName: "Stark",
  },
  {
    firstName: "Robb",
    lastName: "Stark",
  },
  {
    firstName: "Sansa",
    lastName: "Stark",
  },
  {
    firstName: "Rickon",
    lastName: "Stark",
  },
  {
    firstName: "Bran",
    lastName: "Stark",
  },
];

export async function createAllContacts(
  input?: Partial<UserCreateInput>,
  slice?: number,
): Promise<[FakeUser, FakeContact[]]> {
  const user = await createTestUser(input);

  let userInputs = inputs.slice(0, slice || inputs.length);
  const contacts = await Promise.all(
    userInputs.map(async (input) => {
      // just to make times deterministic so that tests can consistently work
      advanceBy(100);
      const builder = getContactBuilder(
        user.viewer,
        getContactInput(user, input),
      );
      // add edge from user to contact
      builder.orchestrator.addInboundEdge(
        user.id,
        EdgeType.UserToContacts,
        NodeType.FakeUser,
        {
          time: new Date(), // set time to advanceBy time
        },
      );
      await builder.saveX();
      return await builder.editedEntX();
    }),
  );
  expect(contacts.length).toBe(userInputs.length);
  return [user, contacts];
}

export async function createUserPlusFriendRequests(
  input?: Partial<UserCreateInput>,
  slice?: number,
): Promise<[FakeUser, FakeUser[]]> {
  const user = await createTestUser(input);

  let userInputs = inputs.slice(0, slice || inputs.length);

  const friendRequests = await Promise.all(
    userInputs.map(async (input) => {
      return createTestUser(input);
    }),
  );
  expect(friendRequests.length).toBe(userInputs.length);

  await addEdge(
    user,
    new FakeUserSchema(),
    EdgeType.UserToFriendRequests,
    true,
    ...friendRequests,
  );

  return [user, friendRequests];
}

export async function addEdge<T extends Ent>(
  source: T,
  schema: BuilderSchema<T>,
  edgeType: string,
  inbound: boolean, // inbound or outbound
  ...dest: Ent[]
) {
  const action = new SimpleAction(
    source.viewer,
    schema,
    new Map(),
    WriteOperation.Edit,
    source,
  );

  dest.forEach(async (friendRequest) => {
    // just to make times deterministic so that tests can consistently work
    advanceBy(100);
    // add edge
    if (inbound) {
      action.builder.orchestrator.addInboundEdge(
        friendRequest.id,
        edgeType,
        dest[0].nodeType,
        {
          time: new Date(), // set time to advanceBy time
        },
      );
    } else {
      action.builder.orchestrator.addOutboundEdge(
        friendRequest.id,
        edgeType,
        dest[0].nodeType,
        {
          time: new Date(), // set time to advanceBy time
        },
      );
    }
  });
  await action.saveX();
}

export function verifyUserToContactEdges(
  user: FakeUser,
  edges: AssocEdge[],
  contacts: FakeContact[],
) {
  expect(edges.length).toBe(contacts.length);

  for (let i = 0; i < contacts.length; i++) {
    const edge = edges[i];
    const expectedEdge = {
      id1: user.id,
      id1Type: NodeType.FakeUser,
      id2: contacts[i].id,
      id2Type: NodeType.FakeContact,
      data: null,
      edgeType: EdgeType.UserToContacts,
    };
    expect(edge, `${i}th index`).toMatchObject(expectedEdge);
    expect(edge.getCursor()).not.toBe("");
  }
}

export function verifyUserToContactRawData(
  user: FakeUser,
  edges: Data[],
  contacts: FakeContact[],
) {
  expect(edges.length).toBe(contacts.length);

  for (let i = 0; i < contacts.length; i++) {
    const edge = edges[i];
    const expectedEdge = contacts[i].data;
    // getting data from db so just checking that data's as expected

    expect(edge, `${i}th index`).toMatchObject(expectedEdge);
  }
}

export function verifyUserToContacts(
  user: FakeUser,
  ents: FakeContact[],
  contacts: FakeContact[],
) {
  expect(ents.length).toBe(contacts.length);
  const expectedContacts = contacts.map((contact) => contact.id);

  expect(ents.map((contact) => contact.id)).toStrictEqual(expectedContacts);
}

export async function createEdges() {
  // create all edges// for now all one-way
  const edgeNames = Object.keys(EdgeType);
  const edges = Object.values(EdgeType);

  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i];
    await createRowForTest({
      tableName: "assoc_edge_config",
      fields: {
        edge_table: snakeCase(`${edge}_table`),
        symmetric_edge: SymmetricEdges.has(edge),
        inverse_edge_type: InverseEdges.get(edge) || null,
        edge_type: edge,
        edge_name: edgeNames[i],
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
    const edgeData = await loadEdgeData(edge);
    expect(edgeData).toBeDefined();
  }
}

export function edgeTableNames() {
  const edges = Object.values(EdgeType);
  return edges.map((edge) => snakeCase(`${edge}_table`));
}

export async function createTestEvent(
  user: FakeUser,
  input?: Partial<EventCreateInput>,
) {
  const vc = new IDViewer(user.id);
  const builder = getEventBuilder(vc, {
    startTime: new Date(),
    location: "fun house",
    description: "fun fun fun",
    title: "fun time",
    userID: user.id,
    ...input,
  });
  builder.orchestrator.addOutboundEdge(user.id, EdgeType.EventToHosts, "User");

  await builder.saveX();
  return await builder.editedEntX();
}

export async function setupTempDB() {
  const tdb = new TempDB(tempDBTables());

  await tdb.beforeAll();

  // create once
  await createEdges();

  return tdb;
}

export function tempDBTables() {
  const tables = [
    FakeUser.getTestTable(),
    FakeContact.getTestTable(),
    FakeEvent.getTestTable(),
    assoc_edge_config_table(),
  ];
  edgeTableNames().forEach((tableName) =>
    tables.push(assoc_edge_table(tableName)),
  );

  return tables;
}

interface options {
  howMany: number;
  interval: number;
  userInput?: Partial<UserCreateInput>;
  eventInputs?: Partial<EventCreateInput>[];
}
export async function createAllEvents(
  opts: options,
): Promise<[FakeUser, FakeEvent[]]> {
  const user = await createTestUser(opts.userInput);

  let arr = new Array(opts.howMany);
  arr.fill(1);

  // start at date in case something else has used a date already
  advanceTo(MockDate.getDate());

  const events = await Promise.all(
    arr.map(async (v, idx: number) => {
      // just to make times deterministic so that tests can consistently work
      if (opts.interval > 0) {
        advanceBy(opts.interval);
      }
      const input = opts.eventInputs?.[idx];
      const builder = getEventBuilder(user.viewer, getEventInput(user, input));
      await builder.saveX();
      return await builder.editedEntX();
    }),
  );
  expect(events.length).toBe(opts.howMany);
  return [user, events];
}
