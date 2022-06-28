import { IDViewer, LoggedOutViewer } from "../../core/viewer";
import { RequestContext } from "../../core/context";
import { AssocEdge } from "../../core/ent";
import { advanceBy } from "jest-date-mock";

import { GraphQLEdge, GraphQLEdgeConnection } from "./edge_connection";
import { GraphQLConnectionType } from "./connection_type";
import {
  GraphQLObjectType,
  GraphQLNonNull,
  GraphQLID,
  GraphQLSchema,
  GraphQLString,
  GraphQLFieldMap,
  GraphQLFieldConfigMap,
} from "graphql";
import { GraphQLNodeInterface } from "../builtins/node";
import {
  expectQueryFromRoot,
  queryRootConfig,
} from "../../testutils/ent-graphql-tests";
import {
  FakeUser,
  EdgeType,
  getUserBuilder,
  UserToFriendsQuery,
  FakeEvent,
  EventToInvitedQuery,
  UserToHostedEventsQuery,
} from "../../testutils/fake_data/index";
import {
  inputs,
  getUserInput,
  createTestUser,
  createTestEvent,
} from "../../testutils/fake_data/test_helpers";

export function sharedAssocTests() {
  // pretty sure this works for custom ents but need tests for this eventually
  describe("not all ents visible", () => {
    let user: FakeUser;
    let event: FakeEvent;
    let users: FakeUser[];
    let conn: GraphQLEdgeConnection<FakeEvent, AssocEdge>;
    let friendCount: number;
    // let's make it big. 20 people
    let friendsInput = [...inputs, ...inputs, ...inputs, ...inputs];
    beforeEach(async () => {
      friendCount = 0;
      user = await createTestUser();
      event = await createTestEvent(user);

      let promises: Promise<FakeUser>[] = [];
      for (let i = 0; i < friendsInput.length; i++) {
        advanceBy(100);
        let input = friendsInput[i];
        const builder = getUserBuilder(user.viewer, getUserInput(input));
        if (i % 2 == 1) {
          builder.orchestrator.addOutboundEdge(
            user.id,
            EdgeType.UserToFriends,
            "User",
          );
          friendCount++;
        }
        // invite user to events
        builder.orchestrator.addInboundEdge(
          event.id,
          EdgeType.EventToInvited,
          "User",
          {
            // just to make times deterministic so that tests can consistently work
            time: new Date(),
          },
        );
        promises.push(
          (async function () {
            await builder.saveX();
            return builder.editedEntX();
          })(),
        );
      }
      users = await Promise.all(promises);

      // only few of the users invited as friends
      const vc = new IDViewer(user.id);
      const friendsEdge = await UserToFriendsQuery.query(
        vc,
        user.id,
      ).queryEdges();
      expect(friendsEdge.length).toBe(friendCount);

      // everyone  invited to event
      const invitedEventsEdges = await EventToInvitedQuery.query(
        vc,
        event.id,
      ).queryEdges();
      expect(invitedEventsEdges.length).toBe(friendsInput.length);

      resetConn();
    });

    function resetConn() {
      conn = new GraphQLEdgeConnection<FakeEvent, AssocEdge>(
        new IDViewer(user.id),
        event,
        (v, event: FakeEvent) => new EventToInvitedQuery(v, event),
      );
    }

    test("totalCount", async () => {
      const count = await conn.queryTotalCount();
      expect(count).toBe(users.length);
    });

    test("nodes", async () => {
      const nodes = await conn.queryNodes();
      expect(nodes.length).toBe(friendCount);
    });

    test("edges", async () => {
      const edges = await conn.queryEdges();
      expect(edges.length).toBe(friendCount);
    });

    test("pagination", async () => {
      const edges = await EventToInvitedQuery.query(
        new LoggedOutViewer(),
        event,
      ).queryEdges();

      async function verify(
        first: number,
        length: number,
        hasNextpage: boolean,
        index?: number,
      ) {
        let cursor: string | undefined;
        if (index) {
          cursor = edges[index].getCursor();
        }
        resetConn();
        conn.first(first, cursor);
        const [pagination, gqlEdges, nodes] = await Promise.all([
          conn.queryPageInfo(),
          conn.queryEdges(),
          conn.queryNodes(),
        ]);
        expect(pagination.hasNextPage, `${index}`).toBe(hasNextpage);
        expect(pagination.hasPreviousPage, `${index}`).toBe(false);
        expect(gqlEdges.length, `${index}`).toBe(length);
        expect(nodes.length, `${index}`).toBe(length);
        // TODO: not equal even though we're querying only one because the cursors are not privacy-aware
        // TODO: fix
      }
      // TODO build exponential backoff into EntQuery so this isn't needed
      // but this is how it is for now
      await verify(1, 1, true);
      await verify(2, 1, true);
      await verify(2, 1, true, 0);
      await verify(2, 1, true, 2);
      await verify(2, 1, true, 4);
      await verify(2, 1, true, 6);
      await verify(2, 1, true, 8);
      await verify(2, 1, true, 10);
      await verify(2, 1, true, 12);
      await verify(2, 1, true, 14);
      await verify(2, 1, true, 16);
      await verify(2, 1, false, 17);
    });
  });

  test("custom edge fields", async () => {
    let userType = new GraphQLObjectType({
      name: "User",
      fields: {
        id: {
          type: GraphQLNonNull(GraphQLID),
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

    let eventType = new GraphQLObjectType({
      name: "Event",
      fields: {
        id: {
          type: GraphQLNonNull(GraphQLID),
        },
      },
      interfaces: [GraphQLNodeInterface],
      isTypeOf(obj, _context: RequestContext) {
        return obj instanceof FakeEvent;
      },
    });

    const conn = new GraphQLConnectionType("CustomEdge", eventType);

    const length = (m: GraphQLFieldMap<any, any>) => {
      let count = 0;
      for (let k in m) {
        count++;
      }
      return count;
    };
    const fields = conn.edgeType.getFields();
    // default.
    expect(length(fields)).toBe(2);
    expect(fields["node"]).toBeDefined();
    expect(fields["cursor"]).toBeDefined();

    const conn2 = new GraphQLConnectionType("CustomEdge", eventType, {
      fields: (): GraphQLFieldConfigMap<
        GraphQLEdge<AssocEdge>,
        RequestContext
      > => ({
        bar: {
          type: GraphQLString,
          resolve() {
            return "customEdgeData";
          },
        },
      }),
    });

    const fields2 = conn2.edgeType.getFields();
    expect(length(fields2)).toBe(3);
    expect(fields2["bar"]).toBeDefined();
    expect(fields2["node"]).toBeDefined();
    expect(fields2["cursor"]).toBeDefined();

    const user = await createTestUser();
    const event = await createTestEvent(user);

    let rootQuery = new GraphQLObjectType({
      name: "RootQueryType",
      fields: {
        conn: {
          type: conn2,
          async resolve(_source, { id }, context: RequestContext) {
            return new GraphQLEdgeConnection<FakeUser, AssocEdge>(
              new IDViewer(user.id),
              user,
              (v, event: FakeUser) => new UserToHostedEventsQuery(v, event),
            );
          },
        },
      },
    });

    let schema = new GraphQLSchema({
      query: rootQuery,
      types: [userType, eventType],
    });

    let cfg: queryRootConfig = {
      schema: schema,
      root: "conn",
      viewer: new IDViewer(user.id),
      args: {},
    };

    await expectQueryFromRoot(cfg, [
      "edges",
      [
        {
          node: {
            id: event.id,
          },
          bar: "customEdgeData",
        },
      ],
    ]);
  });
}
