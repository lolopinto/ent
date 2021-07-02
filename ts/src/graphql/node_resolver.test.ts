import {
  FakeUser,
  FakeContact,
  EdgeType,
  UserToFriendsQuery,
  FakeEvent,
  NodeType,
  FakeUserSchema,
  UserToIncomingFriendRequestsQuery,
  UserToFriendRequestsQuery,
  ViewerWithAccessToken,
} from "../testutils/fake_data";
import {
  createTestUser,
  createTestEvent,
  createEdges,
  createAllContacts,
  tempDBTables,
} from "../testutils/fake_data/test_helpers";
import { QueryRecorder } from "../testutils/db_mock";
import { Pool } from "pg";
import { Viewer, ID, Ent, LoadEntOptions } from "../core/base";
import { loadEnt } from "../core/ent";
import {
  NodeResolver,
  EntNodeResolver,
  resolveID,
  registerResolver,
  nodeIDEncoder,
  clearResolvers,
} from "./node_resolver";
import { IDViewer } from "../core/viewer";
import { RequestContext } from "../core/context";
import { SimpleBuilder } from "../testutils/builder";
import { WriteOperation } from "../action";
import {
  GraphQLObjectType,
  GraphQLNonNull,
  GraphQLID,
  GraphQLSchema,
  GraphQLString,
} from "graphql";
import { GraphQLNodeInterface } from "./builtins/node";
import {
  queryRootConfig,
  expectQueryFromRoot,
} from "../testutils/ent-graphql-tests";
import { setupSqlite } from "../testutils/db/test_db";

jest.mock("pg");
QueryRecorder.mockPool(Pool);

async function loadEntByType(
  viewer: Viewer,
  type: NodeType,
  id: ID,
): Promise<Ent | null> {
  return loadEnt(viewer, id, getLoaderOptions(type));
}

export function getLoaderOptions(type: NodeType): LoadEntOptions<Ent> {
  switch (type) {
    case NodeType.FakeUser:
      return FakeUser.loaderOptions();
    case NodeType.FakeContact:
      return FakeContact.loaderOptions();
    case NodeType.FakeEvent:
      return FakeEvent.loaderOptions();
  }
}

const resolver = new EntNodeResolver(loadEntByType);
beforeEach(() => {
  registerResolver("entNode", resolver);
});
afterEach(() => {
  clearResolvers();
});

async function testObj(ent: Ent, vc?: Viewer) {
  const resolver = new EntNodeResolver(loadEntByType);
  const encodedID = resolver.encode(ent);
  const decodedID = EntNodeResolver.decode(encodedID);
  expect(decodedID).toEqual(ent.id);

  vc = vc || new IDViewer(ent.id);

  const decodedObj = await resolver.decodeObj(vc, encodedID);
  expect(decodedObj).not.toBeNull();
  expect(decodedObj!.id).toBe(ent.id);
}

interface SearchResultData {
  id: ID;
  context: string; // 'friend', 'friendRequestSent', 'friendRequestReceived'
}

class SearchResult {
  id: ID;
  constructor(public data: SearchResultData) {
    this.id = data.id;
  }

  decodedID() {
    return new SearchResultResolver().encode(this);
  }

  static async search(v: Viewer, user: FakeUser) {
    const [friendsEdge, friendRequestsEdge, incomingFriendRequestsEdge] =
      await Promise.all([
        UserToFriendsQuery.query(v, user).queryEdges(),
        UserToFriendRequestsQuery.query(v, user).queryEdges(),
        UserToIncomingFriendRequestsQuery.query(v, user).queryEdges(),
      ]);

    let results: SearchResult[] = [];

    friendsEdge.forEach((edge) =>
      results.push(
        new SearchResult({
          id: edge.id2,
          context: "friend",
        }),
      ),
    );
    friendRequestsEdge.forEach((edge) =>
      results.push(
        new SearchResult({
          id: edge.id2,
          context: "friendRequestSent",
        }),
      ),
    );
    incomingFriendRequestsEdge.forEach((edge) =>
      results.push(
        new SearchResult({
          id: edge.id2,
          context: "friendRequestReceived",
        }),
      ),
    );
    return results;
  }
}

class SearchResultResolver implements NodeResolver {
  encode(result: SearchResult) {
    const str = `searchResult:${result.data.context}:${result.id}`;
    return Buffer.from(str, "ascii").toString("base64");
  }

  async decodeObj(viewer: Viewer, id: string) {
    const decoded = Buffer.from(id, "base64").toString("ascii");
    let parts = decoded.split(":");
    if (parts.length != 3) {
      return null;
    }

    viewer = new ViewerWithAccessToken(viewer.viewerID!, {
      tokens: {
        allow_outbound_friend_request: true,
        allow_incoming_friend_request: true,
      },
    });

    const user = await FakeUser.load(viewer, parts[2]);
    if (!user) {
      return null;
    }
    // context here is actually wrong but don't care enough to grab the data and make it right
    return new SearchResult({ id: user.id, context: "friendRequest" });
  }
}

function commonTests() {
  test("user", async () => {
    const user = await createTestUser();

    await testObj(user);
  });

  test("event", async () => {
    const user = await createTestUser();
    const event = await createTestEvent(user);

    await testObj(event, new IDViewer(user.id));
  });

  test("contact", async () => {
    const [user, contacts] = await createAllContacts();

    await testObj(contacts[0], new IDViewer(user.id));
  });

  test("customresolver", async () => {
    let [user, friend, friendRequestSent, friendRequestReceived] =
      await Promise.all([
        createTestUser(),
        createTestUser(),
        createTestUser(),
        createTestUser(),
      ]);

    const vc = new IDViewer(user.id);
    const builder = new SimpleBuilder(
      vc,
      new FakeUserSchema(),
      new Map(),
      WriteOperation.Edit,
      user,
    );

    builder.orchestrator.addOutboundEdge(
      friend.id,
      EdgeType.UserToFriends,
      NodeType.FakeUser,
    );
    builder.orchestrator.addOutboundEdge(
      friendRequestSent.id,
      EdgeType.UserToFriendRequests,
      NodeType.FakeUser,
    );
    builder.orchestrator.addOutboundEdge(
      friendRequestReceived.id,
      EdgeType.UserToIncomingFriendRequests,
      NodeType.FakeUser,
    );

    await builder.saveX();
    user = await builder.editedEntX();

    const [friendsEdge, friendRequestsEdge, incomingFriendRequestsEdge] =
      await Promise.all([
        UserToFriendsQuery.query(user.viewer, user).queryEdges(),
        UserToFriendRequestsQuery.query(user.viewer, user).queryEdges(),
        UserToIncomingFriendRequestsQuery.query(user.viewer, user).queryEdges(),
      ]);

    expect(friendsEdge.length).toEqual(1);
    expect(friendRequestsEdge.length).toEqual(1);
    expect(incomingFriendRequestsEdge.length).toEqual(1);

    // can't load these users in this context
    let friendRequestLoaded = await FakeUser.load(
      user.viewer,
      friendRequestSent.id,
    );
    expect(friendRequestLoaded).toBe(null);
    let friendRequestReceivedLoaded = await FakeUser.load(
      user.viewer,
      friendRequestReceived.id,
    );
    expect(friendRequestReceivedLoaded).toBe(null);
    let friendLoaded = await FakeUser.load(user.viewer, friend.id);
    expect(friendLoaded).not.toBe(null);

    const vc2 = new ViewerWithAccessToken(user.id, {
      tokens: {
        allow_outbound_friend_request: true,
        allow_incoming_friend_request: true,
      },
    });
    friendRequestLoaded = await FakeUser.load(vc2, friendRequestSent.id);
    expect(friendRequestLoaded).not.toBe(null);
    friendRequestReceivedLoaded = await FakeUser.load(
      vc2,
      friendRequestReceived.id,
    );
    expect(friendRequestReceivedLoaded).not.toBe(null);
    friendLoaded = await FakeUser.load(vc2, friend.id);
    expect(friendLoaded).not.toBe(null);

    // can do a "search" and have the eventual node() call work by resolving the ids
    const searchResults = await SearchResult.search(vc2, user);
    const ids = searchResults.map((result) => result.decodedID());

    // not registered so we can't do anything with this
    for (const id of ids) {
      const node = await resolveID(vc, id);
      expect(node).toBeNull();
    }

    // now registered and loaded!
    registerResolver("searchResult", new SearchResultResolver());
    for (const id of ids) {
      const node = await resolveID(vc, id);
      expect(node).not.toBeNull();
      expect(node).toBeInstanceOf(SearchResult);
    }
  });

  test("node id encoder", async () => {
    let userType = new GraphQLObjectType({
      name: "User",
      fields: {
        id: {
          type: GraphQLNonNull(GraphQLID),
          resolve: nodeIDEncoder,
        },
        firstName: {
          type: GraphQLString,
        },
        lastName: {
          type: GraphQLString,
        },
      },
      interfaces: [GraphQLNodeInterface],
      isTypeOf(obj, _context: RequestContext) {
        return obj instanceof FakeUser;
      },
    });

    let viewerType = new GraphQLObjectType({
      name: "Viewer",
      fields: {
        user: {
          type: GraphQLNonNull(userType),
          resolve: (_source, {}, context: RequestContext) => {
            const v = context.getViewer();
            if (!v.viewerID) {
              // will throw. we claim non-null
              return null;
            }
            return FakeUser.load(v, v.viewerID);
          },
        },
      },
    });

    let rootQuery = new GraphQLObjectType({
      name: "RootQueryType",
      fields: {
        node: {
          args: {
            id: {
              type: GraphQLNonNull(GraphQLID),
            },
          },
          type: GraphQLNodeInterface,
          resolve(_source, { id }, context: RequestContext) {
            return resolveID(context.getViewer(), id);
          },
        },
        viewer: {
          type: viewerType,
          resolve: (_source, _args, context: RequestContext) => {
            return context.getViewer();
          },
        },
      },
    });

    let schema = new GraphQLSchema({
      query: rootQuery,
    });

    const user = await createTestUser();

    let cfg: queryRootConfig = {
      schema: schema,
      root: "viewer",
      viewer: new IDViewer(user.id),
      args: {},
    };

    const expectedID = resolver.encode(user);
    await expectQueryFromRoot(cfg, ["user.id", expectedID]);

    let cfg2: queryRootConfig = {
      schema: schema,
      root: "node",
      viewer: new IDViewer(user.id),
      args: { id: expectedID },
    };

    await expectQueryFromRoot(cfg2, [
      "...on User",
      {
        id: expectedID,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    ]);
  });
}

describe("postgres", () => {
  beforeEach(async () => {
    QueryRecorder.clear();
    await createEdges();
    QueryRecorder.clearQueries();
  });
  commonTests();
});

describe("sqlite", () => {
  setupSqlite(`sqlite:///node_resolver.db`, tempDBTables);

  beforeEach(async () => {
    await createEdges();
  });
  commonTests();
});
