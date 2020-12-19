import { fail } from "assert";
import { advanceBy } from "jest-date-mock";
import { IDViewer, LoggedOutViewer } from "../../src/core/viewer";
import { ID, AssocEdge, loadEdgeData } from "../../src/core/ent";
import { snakeCase } from "snake-case";
import { createRowForTest } from "../../src/testutils/write";

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
} from ".";
import { EventCreateInput, getEventBuilder } from "./fake_event";
import { NodeType } from "./const";

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
): Promise<[FakeUser, FakeContact[]]> {
  const user = await createTestUser(input);

  const contacts = await Promise.all(
    inputs.map(async (input) => {
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
      return await builder.saveX();
    }),
  );
  expect(contacts.length).toBe(inputs.length);
  return [user, contacts];
}

export function verifyUserToContactEdges(
  user: FakeUser,
  edgesMap: Map<ID, AssocEdge[]>,
  contacts: FakeContact[],
) {
  const edges = edgesMap.get(user.id) || [];
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

export function verifyUserToContacts(
  user: FakeUser,
  entsMap: Map<ID, FakeContact[]>,
  contacts: FakeContact[],
) {
  const ents = entsMap.get(user.id) || [];
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
      },
    });
    await loadEdgeData(edge);
  }
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

  return await builder.saveX();
}
