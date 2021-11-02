import { QueryRecorder } from "../../testutils/db_mock";
import { ID, Ent, Viewer } from "../base";
import { AssocEdge, DefaultLimit } from "../ent";
import { EdgeQuery } from "./query";
import { EdgeQueryCtr } from "./assoc_query";
import { IDViewer, LoggedOutViewer } from "../viewer";
import { advanceBy } from "jest-date-mock";
import {
  FakeUser,
  UserToContactsQuery,
  UserToFollowingQuery,
  FakeContact,
  EdgeType,
  getUserBuilder,
  UserToFriendsQuery,
  FakeEvent,
  UserToEventsAttendingQuery,
  EventToHostsQuery,
  NodeType,
  UserToCustomEdgeQuery,
  CustomEdge,
  getEventBuilder,
  UserToFriendRequestsQuery,
  UserToIncomingFriendRequestsQuery,
  ViewerWithAccessToken,
} from "../../testutils/fake_data/index";
import {
  inputs,
  getUserInput,
  createTestUser,
  createAllContacts,
  verifyUserToContactEdges,
  verifyUserToContacts,
  createTestEvent,
  getEventInput,
  createUserPlusFriendRequests,
} from "../../testutils/fake_data/test_helpers";
import DB, { Dialect } from "../db";

export function assocTests() {
  describe("custom edge", () => {
    let user1, user2: FakeUser;

    beforeEach(async () => {
      user2 = await createTestUser();

      const builder = getUserBuilder(new LoggedOutViewer(), getUserInput());
      builder.orchestrator.addOutboundEdge(
        user2.id,
        EdgeType.UserToCustomEdge,
        NodeType.FakeUser,
      );
      await builder.saveX();
      user1 = await builder.editedEntX();
    });

    test("ids", async () => {
      const ids = await UserToCustomEdgeQuery.query(
        user1.viewer,
        user1,
      ).queryIDs();
      expect(ids.length).toBe(1);
      expect(ids).toEqual([user2.id]);
    });

    test("edges", async () => {
      const edges = await UserToCustomEdgeQuery.query(
        user1.viewer,
        user1,
      ).queryEdges();
      expect(edges.length).toBe(1);
      const edge = edges![0];
      expect(edge).toBeInstanceOf(CustomEdge);
      expect(edge.id1).toBe(user1.id);
      expect(edge.id2).toBe(user2.id);
      expect(edge.edgeType).toBe(EdgeType.UserToCustomEdge);
    });

    test("id2", async () => {
      const edge = await UserToCustomEdgeQuery.query(
        user1.viewer,
        user1,
      ).queryID2(user2.id);
      expect(edge).toBeDefined();
      expect(edge).toBeInstanceOf(CustomEdge);
      expect(edge!.id1).toBe(user1.id);
      expect(edge!.id2).toBe(user2.id);
      expect(edge!.edgeType).toBe(EdgeType.UserToCustomEdge);
    });
  });

  const N = 2;
  function firstNFilter(q: UserToContactsQuery) {
    return q.first(N);
  }

  function firstNEntsFilter(contacts: FakeContact[]) {
    return contacts.reverse().slice(0, N);
  }

  function verifyQuery({
    length = 1,
    numQueries = 1,
    limit = DefaultLimit,
    disablePaginationBump = false,
  }) {
    if (DB.getDialect() === Dialect.SQLite) {
      return;
    }
    const queries = QueryRecorder.getCurrentQueries();
    expect(queries.length).toBe(length);
    for (let i = 0; i < numQueries; i++) {
      const query = queries[i];
      let expLimit = disablePaginationBump ? limit : limit + 1;
      expect(query.qs?.whereClause, `${i}`).toBe(
        // default limit
        `id1 = $1 AND edge_type = $2 ORDER BY time DESC LIMIT ${expLimit}`,
      );
    }
  }

  function verifyCountQuery({ length = 1, numQueries = 1 }) {
    if (DB.getDialect() === Dialect.SQLite) {
      return;
    }
    const queries = QueryRecorder.getCurrentQueries();
    expect(queries.length).toBe(length);
    for (let i = 0; i < numQueries; i++) {
      const query = queries[i];
      expect(query.qs?.whereClause).toBe(`id1 = $1 AND edge_type = $2`);
    }
  }

  // TODO need to test multi-ids with id1s that aren't visible...
  // so 2 user's friend requests at the same time
  class MultiIDsTestQueryFilter {
    dataz: [FakeUser, FakeContact[]][] = [];
    constructor(
      private filter: (q: UserToContactsQuery) => UserToContactsQuery,
      private ents: (contacts: FakeContact[]) => FakeContact[],
      private limit?: number,
    ) {}

    async beforeEach() {
      let [user1, user2, user3] = await Promise.all([
        createAllContacts({ firstName: "Jon", lastName: "Snow" }),
        createAllContacts({ firstName: "Aegon", lastName: "Targaryen" }),
        createAllContacts({ firstName: "Ned", lastName: "Stark" }),
      ]);
      // modify contacts as needed
      user1[1] = this.ents(user1[1]);
      user2[1] = this.ents(user2[1]);
      user3[1] = this.ents(user3[1]);
      this.dataz = [user1, user2, user3];
      QueryRecorder.clearQueries();
    }

    getQuery(viewer?: Viewer) {
      return this.filter(
        UserToContactsQuery.query(
          viewer || new LoggedOutViewer(),
          this.dataz.map((data) => data[0]),
        ),
      );
    }

    async testIDs() {
      const idsMap = await this.getQuery().queryAllIDs();

      expect(idsMap.size).toBe(this.dataz.length);

      for (let i = 0; i < this.dataz.length; i++) {
        let data = this.dataz[i];

        expect(idsMap.get(data[0].id)).toEqual(
          data[1].map((contact) => contact.id),
        );
      }
      verifyQuery({
        length: this.dataz.length,
        numQueries: this.dataz.length,
        limit: this.limit || DefaultLimit,
      });
    }

    // rawCount isn't affected by filters...
    async testRawCount() {
      const countMap = await this.getQuery().queryAllRawCount();

      expect(countMap.size).toBe(this.dataz.length);

      for (let i = 0; i < this.dataz.length; i++) {
        let data = this.dataz[i];

        expect(countMap.get(data[0].id)).toStrictEqual(inputs.length);
      }
      verifyCountQuery({ numQueries: 3, length: 3 });
    }

    async testCount() {
      const countMap = await this.getQuery().queryAllCount();

      expect(countMap.size).toBe(this.dataz.length);

      for (let i = 0; i < this.dataz.length; i++) {
        let data = this.dataz[i];

        expect(countMap.get(data[0].id)).toStrictEqual(data[1].length);
      }
      verifyQuery({
        length: this.dataz.length,
        numQueries: this.dataz.length,
        limit: this.limit || DefaultLimit,
      });
    }

    async testEdges() {
      const edgesMap = await this.getQuery().queryAllEdges();

      expect(edgesMap.size).toBe(this.dataz.length);

      for (let i = 0; i < this.dataz.length; i++) {
        let data = this.dataz[i];

        verifyUserToContactEdges(
          data[0],
          edgesMap.get(data[0].id) || [],
          data[1],
        );
      }
      verifyQuery({
        length: this.dataz.length,
        numQueries: this.dataz.length,
        limit: this.limit || DefaultLimit,
      });
    }

    async testEnts() {
      // privacy...
      const entsMap = await this.getQuery().queryAllEnts();
      expect(entsMap.size).toBe(this.dataz.length);
      for (let i = 0; i < this.dataz.length; i++) {
        let data = this.dataz[i];
        verifyUserToContacts(data[0], entsMap.get(data[0].id) || [], []);
      }

      // privacy. only data for the first id is visible in this case
      const entsMap2 = await this.getQuery(
        new IDViewer(this.dataz[0][0].id),
      ).queryAllEnts();
      expect(entsMap2.size).toBe(this.dataz.length);
      for (let i = 0; i < this.dataz.length; i++) {
        let data = this.dataz[i];
        verifyUserToContacts(
          data[0],
          entsMap2.get(data[0].id) || [],
          i == 0 ? data[1] : [],
        );
      }
      verifyQuery({
        // extra query for the nodes
        // dataz.length twice to fetch the edge data
        // and then twice to fetch all the nodes for the contacts
        length: this.dataz.length + this.dataz.length + this.dataz.length * 2,
        numQueries: this.dataz.length,
        limit: this.limit || DefaultLimit,
      });
    }
  }

  describe("multi-ids", () => {
    const filter = new MultiIDsTestQueryFilter(
      (q: UserToContactsQuery) => {
        // no filters
        return q;
      },
      (contacts: FakeContact[]) => {
        // nothing to do here
        // reverse because edges are most recent first
        return contacts.reverse();
      },
    );

    beforeEach(async () => {
      await filter.beforeEach();
    });

    test("ids", async () => {
      await filter.testIDs();
    });

    test("rawCount", async () => {
      await filter.testRawCount();
    });

    test("count", async () => {
      await filter.testCount();
    });

    test("edges", async () => {
      await filter.testEdges();
    });

    test("ents", async () => {
      await filter.testEnts();
    });

    test("id2", async () => {
      //    const users = filter.dataz.map((data) => data[0]);
      for (let i = 0; i < filter.dataz.length; i++) {
        const id1 = filter.dataz[i][0].id;
        // get user that corresponds to position
        const query = filter.getQuery(new IDViewer(id1));

        const id2 = filter.dataz[i][1][0].id;
        //get first contact for user
        const m = await query.queryAllID2(id2);

        for (let j = 0; j < filter.dataz.length; j++) {
          const edge = m.get(filter.dataz[j][0].id);
          if (i == j) {
            expect(edge).toBeDefined();
            expect(edge).toBeInstanceOf(AssocEdge);
            expect(edge!.id1).toBe(id1);
            expect(edge!.id2).toBe(id2);
            expect(edge!.edgeType).toBe(EdgeType.UserToContacts);
          } else {
            expect(edge).toBeUndefined();
          }
        }
      }
    });
  });

  describe("multi-ids. firstN", () => {
    const filter = new MultiIDsTestQueryFilter(
      firstNFilter,
      firstNEntsFilter,
      2,
    );

    beforeEach(async () => {
      await filter.beforeEach();
    });

    test("ids", async () => {
      await filter.testIDs();
    });

    test("rawCount", async () => {
      await filter.testRawCount();
    });

    test("count", async () => {
      await filter.testCount();
    });

    test("edges", async () => {
      await filter.testEdges();
    });

    test("ents", async () => {
      await filter.testEnts();
    });
  });

  class ChainTestQueryFilter {
    user: FakeUser;
    event: FakeEvent;
    event2: FakeEvent;
    friends: FakeUser[];

    constructor(
      private initialQuery: EdgeQueryCtr<FakeUser, Ent, AssocEdge>,
      private subsequentQueries: EdgeQueryCtr<Ent, Ent, AssocEdge>[],
      private filter: (
        q: EdgeQuery<FakeUser, Ent, AssocEdge>,
      ) => EdgeQuery<FakeUser, Ent, AssocEdge>,
      private lastHopFilter?: (
        q: EdgeQuery<Ent, Ent, AssocEdge>,
      ) => EdgeQuery<Ent, Ent, AssocEdge>,
    ) {}

    async beforeEach() {
      this.user = await createTestUser();
      this.event = await createTestEvent(this.user);
      this.event2 = await createTestEvent(this.user, { title: "Red Wedding" });

      this.friends = await Promise.all(
        inputs.map(async (input) => {
          // just to make times deterministic so that tests can consistently work
          advanceBy(100);
          const builder = getUserBuilder(this.user.viewer, getUserInput(input));
          // add edge from user to contact
          builder.orchestrator.addOutboundEdge(
            this.user.id,
            EdgeType.UserToFriends,
            NodeType.FakeUser,
            {
              time: new Date(), // set time to advanceBy time
            },
          );
          // all invited and all attending
          builder.orchestrator.addInboundEdge(
            this.event.id,
            EdgeType.EventToInvited,
            "Event",
          );
          builder.orchestrator.addInboundEdge(
            this.event.id,
            EdgeType.EventToAttendees,
            NodeType.FakeEvent,
          );
          // Robb also attending the red wedding
          if (input.firstName === "Robb") {
            builder.orchestrator.addInboundEdge(
              this.event2.id,
              EdgeType.EventToInvited,
              NodeType.FakeEvent,
            );
            builder.orchestrator.addInboundEdge(
              this.event2.id,
              EdgeType.EventToAttendees,
              NodeType.FakeEvent,
            );
          }
          await builder.saveX();
          return await builder.editedEntX();
        }),
      );

      expect(this.friends.length).toBe(inputs.length);

      const count = await UserToFriendsQuery.query(
        new IDViewer(this.user.id),
        this.user.id,
      ).queryCount();
      expect(count).toStrictEqual(inputs.length);
    }

    getQuery(vc: Viewer) {
      return this.filter(new this.initialQuery(vc, this.user.id));
    }

    private async compare(
      fn: (q: EdgeQuery<Ent, Ent, AssocEdge>) => any,
      comparer?: (oneHop: any, allHops: any) => any,
    ) {
      const vc = new IDViewer(this.user.id);
      const oneHopResult = await fn(this.getQuery(vc));

      const queries = [this.initialQuery, ...this.subsequentQueries];
      let last: ID[] = [this.user.id];
      let allHopsResult: any;
      for (let i = 0; i < queries.length; i++) {
        let queryCtr = queries[i];

        let query = new queryCtr(vc, last);
        if (this.lastHopFilter && i + 1 == queries.length - 1) {
          query = this.lastHopFilter(query);
        }
        if (i === queries.length - 1) {
          allHopsResult = await fn(query);
          break;
        }

        let result = await query.queryAllIDs();
        last = [];
        for (const [_, ids] of result) {
          last.push(...ids);
        }
      }
      if (comparer) {
        comparer(oneHopResult, allHopsResult);
      } else {
        expect(oneHopResult).toStrictEqual(allHopsResult);
      }
    }

    async testIDs() {
      await this.compare((q) => q.queryAllIDs());
    }

    async testCount() {
      await this.compare((q) => q.queryAllCount());
    }

    async testRawCount() {
      await this.compare((q) => q.queryAllRawCount());
    }

    async testEdges() {
      await this.compare((q) => q.queryAllEdges());
    }

    async testEnts() {
      function compare(oneHop: Map<ID, Ent[]>, allHops: Map<ID, Ent[]>) {
        expect(allHops.size).toEqual(oneHop.size);
        for (const [key, ents] of allHops) {
          expect(oneHop.has(key)).toEqual(true);

          const oneHopEnts = oneHop.get(key)!;
          for (let i = 0; i < ents.length; i++) {
            expect(oneHopEnts[i].id).toEqual(ents[i].id);
          }
        }
      }
      await this.compare((q) => q.queryAllEnts(), compare);
    }
  }

  describe("chained queries 2 steps", () => {
    const filter = new ChainTestQueryFilter(
      UserToFriendsQuery,
      [UserToEventsAttendingQuery],
      (q: UserToFriendsQuery) => {
        return q.queryEventsAttending();
      },
    );

    beforeEach(async () => {
      await filter.beforeEach();
    });

    test("ids", async () => {
      await filter.testIDs();
    });

    test("count", async () => {
      await filter.testCount();
    });

    test("rawCount", async () => {
      await filter.testRawCount();
    });

    test("edges", async () => {
      await filter.testEdges();
    });

    test("ents", async () => {
      await filter.testEnts();
    });
  });

  describe("chained queries 2 steps w/ filter", () => {
    const filter = new ChainTestQueryFilter(
      UserToFriendsQuery,
      [UserToEventsAttendingQuery],
      (q: UserToFriendsQuery) => {
        return q.first(2).queryEventsAttending();
      },
      (q: UserToFriendsQuery) => {
        return q.first(2);
      },
    );

    beforeEach(async () => {
      await filter.beforeEach();
    });

    test("ids", async () => {
      await filter.testIDs();
    });

    test("count", async () => {
      await filter.testCount();
    });

    test("rawCount", async () => {
      await filter.testRawCount();
    });

    test("edges", async () => {
      await filter.testEdges();
    });

    test("ents", async () => {
      await filter.testEnts();
    });
  });

  describe("chained queries 3 steps", () => {
    const filter = new ChainTestQueryFilter(
      UserToFriendsQuery,
      [UserToEventsAttendingQuery, EventToHostsQuery],
      (q: UserToFriendsQuery) => {
        return q.queryEventsAttending().queryHosts();
      },
    );

    beforeEach(async () => {
      await filter.beforeEach();
    });

    test("ids", async () => {
      await filter.testIDs();
    });

    test("count", async () => {
      await filter.testCount();
    });

    test("rawCount", async () => {
      await filter.testRawCount();
    });

    test("edges", async () => {
      await filter.testEdges();
    });

    test("ents", async () => {
      await filter.testEnts();
    });
  });

  class PolymorphicID2sTestQueryFilter {
    user: FakeUser;
    users: FakeUser[] = [];
    events: FakeEvent[] = [];
    expCount: number;
    constructor(
      private filter: (q: UserToFollowingQuery) => UserToFollowingQuery,
      private ents: (ent: Ent[]) => Ent[],
      private limit?: number,
    ) {}

    async beforeEach() {
      this.users = [];
      this.events = [];
      this.user = await createTestUser();
      for (let i = 0; i < 5; i++) {
        advanceBy(100);

        const builder = getUserBuilder(this.user.viewer, getUserInput());
        builder.orchestrator.addOutboundEdge(
          this.user.id,
          EdgeType.ObjectToFollowedUsers,
          NodeType.FakeUser,
        );
        await builder.saveX();
        const user2 = await builder.editedEntX();
        this.users.push(user2);
      }
      for (let i = 0; i < 5; i++) {
        advanceBy(100);

        const builder = getEventBuilder(
          this.user.viewer,
          getEventInput(this.user),
        );
        builder.orchestrator.addOutboundEdge(
          this.user.id,
          EdgeType.ObjectToFollowedUsers,
          NodeType.FakeUser,
        );
        await builder.saveX();
        const event = await builder.editedEntX();
        this.events.push(event);
      }
      //order is users, then events
      this.expCount = this.ents([...this.users, ...this.events]).length;

      QueryRecorder.clearQueries();
    }

    getQuery(viewer?: Viewer) {
      return this.filter(
        UserToFollowingQuery.query(
          viewer || new IDViewer(this.user.id),
          this.user,
        ),
      );
    }

    async testIDs() {
      const ids = await this.getQuery().queryIDs();

      expect(ids.length).toBe(this.expCount);

      const expIDs = this.users
        .map((user) => user.id)
        .concat(this.events.map((event) => event.id))
        .reverse();

      expect(expIDs).toEqual(ids);
      verifyQuery({
        length: 1,
        numQueries: 1,
        limit: this.limit || DefaultLimit,
      });
    }

    // rawCount isn't affected by filters...
    async testRawCount() {
      const count = await this.getQuery().queryRawCount();

      expect(count).toBe(this.expCount);

      verifyCountQuery({ numQueries: 1, length: 1 });
    }

    async testCount() {
      const count = await this.getQuery().queryCount();

      expect(count).toBe(this.expCount);

      verifyQuery({
        length: 1,
        numQueries: 1,
        limit: this.limit || DefaultLimit,
      });
    }

    async testEdges() {
      const edges = await this.getQuery().queryEdges();

      expect(edges.length).toBe(this.expCount);

      let userCount = 0;
      let eventCount = 0;
      edges.forEach((edge) => {
        if (edge.id2Type === NodeType.FakeEvent) {
          eventCount++;
        }
        if (edge.id2Type === NodeType.FakeUser) {
          userCount++;
        }
      });
      expect(userCount).toBe(this.expCount / 2);
      expect(eventCount).toBe(this.expCount / 2);
      verifyQuery({
        length: 1,
        numQueries: 1,
        limit: this.limit || DefaultLimit,
      });
    }

    async testEnts() {
      // privacy...
      const ents = await this.getQuery().queryEnts();
      expect(ents.length).toBe(this.expCount);

      let userCount = 0;
      let eventCount = 0;
      ents.forEach((ent) => {
        if (ent instanceof FakeEvent) {
          eventCount++;
        }
        if (ent instanceof FakeUser) {
          userCount++;
        }
      });
      expect(userCount).toBe(this.expCount / 2);
      expect(eventCount).toBe(this.expCount / 2);

      // when doing privacy checks, hard to say what will be fetched
      // verifyQuery({
      //   // 1 for edges, 1 for users, 1 for events
      //   length: 3,
      //   numQueries: 3,
      //   limit: this.limit || DefaultLimit,
      // });
    }
  }

  describe("polymorphic id2s", () => {
    const filter = new PolymorphicID2sTestQueryFilter(
      (q: UserToFollowingQuery) => {
        // no filters
        return q;
      },
      (ents: Ent[]) => {
        // nothing to do here
        // reverse because edges are most recent first
        return ents.reverse();
      },
    );

    // TODO not working when it's a beforeAll
    // working with beforeEach but we should only need to create this data once
    beforeEach(async () => {
      await filter.beforeEach();
    });

    test("ids", async () => {
      await filter.testIDs();
    });

    test("rawCount", async () => {
      await filter.testRawCount();
    });

    test("count", async () => {
      await filter.testCount();
    });

    test("edges", async () => {
      await filter.testEdges();
    });

    test("ents", async () => {
      await filter.testEnts();
    });
  });

  describe("privacy", () => {
    let user: FakeUser;
    let friendRequests: FakeUser[];
    let user2: FakeUser;
    beforeEach(async () => {
      [user, friendRequests] = await createUserPlusFriendRequests();
      user2 = await createTestUser();
    });

    function getQuery(viewer: Viewer) {
      return UserToIncomingFriendRequestsQuery.query(viewer, user.id);
    }

    test("ids", async () => {
      const ids = await getQuery(user2.viewer).queryIDs();
      expect(ids.length).toBe(0);

      const idsFromUser = await getQuery(user.viewer).queryIDs();
      expect(idsFromUser.length).toBe(friendRequests.length);
    });

    test("count", async () => {
      const count = await getQuery(user2.viewer).queryCount();
      expect(count).toBe(0);

      const countFromUser = await getQuery(user.viewer).queryCount();
      expect(countFromUser).toBe(friendRequests.length);
    });

    test("rawCount", async () => {
      const rawCount = await getQuery(user2.viewer).queryRawCount();
      expect(rawCount).toBe(0);

      const rawCountFromUser = await getQuery(user.viewer).queryRawCount();
      expect(rawCountFromUser).toBe(friendRequests.length);
    });

    test("edges", async () => {
      const edges = await getQuery(user2.viewer).queryEdges();
      expect(edges.length).toBe(0);

      const edgesFromUser = await getQuery(user.viewer).queryEdges();
      expect(edgesFromUser.length).toBe(friendRequests.length);
    });

    test("ents", async () => {
      const ents = await getQuery(user2.viewer).queryEnts();
      expect(ents.length).toBe(0);

      const entsFromUser = await getQuery(user.viewer).queryEnts();
      expect(entsFromUser.length).toBe(0);

      const entsFromUserVCToken = await getQuery(
        new ViewerWithAccessToken(user.id, {
          tokens: {
            allow_incoming_friend_request: true,
          },
        }),
      ).queryEnts();
      expect(entsFromUserVCToken.length).toBe(friendRequests.length);
    });
  });

  describe("multi-ids privacy", () => {
    let user: FakeUser;
    let friendRequests: FakeUser[];
    let user2: FakeUser;
    let friendRequests2: FakeUser[];
    beforeEach(async () => {
      [user, friendRequests] = await createUserPlusFriendRequests();
      [user2, friendRequests2] = await createUserPlusFriendRequests();
    });

    function getQuery(viewer?: Viewer) {
      return UserToIncomingFriendRequestsQuery.query(viewer || user.viewer, [
        user.id,
        user2.id,
      ]);
    }

    test("ids", async () => {
      const idsMap = await getQuery().queryAllIDs();
      expect(idsMap.size).toBe(2);

      expect(idsMap.get(user.id)?.length).toBe(friendRequests.length);
      expect(idsMap.get(user2.id)?.length).toBe(0);
    });

    test("count", async () => {
      const countMap = await getQuery().queryAllCount();
      expect(countMap.size).toBe(2);

      expect(countMap.get(user.id)).toBe(friendRequests.length);
      expect(countMap.get(user2.id)).toBe(0);
    });

    test("count", async () => {
      const countMap = await getQuery().queryAllRawCount();
      expect(countMap.size).toBe(2);

      expect(countMap.get(user.id)).toBe(friendRequests.length);
      expect(countMap.get(user2.id)).toBe(0);
    });

    test("edges", async () => {
      const edgesMap = await getQuery().queryAllEdges();
      expect(edgesMap.size).toBe(2);

      expect(edgesMap.get(user.id)?.length).toBe(friendRequests.length);
      expect(edgesMap.get(user2.id)?.length).toBe(0);
    });

    test("ents", async () => {
      const entsMap = await getQuery().queryAllEnts();
      expect(entsMap.size).toBe(2);

      expect(entsMap.get(user.id)?.length).toBe(0);
      expect(entsMap.get(user2.id)?.length).toBe(0);

      const entsMapFromUserVCToken = await getQuery(
        new ViewerWithAccessToken(user.id, {
          tokens: {
            allow_incoming_friend_request: true,
          },
        }),
      ).queryAllEnts();
      expect(entsMapFromUserVCToken.size).toBe(2);

      expect(entsMapFromUserVCToken.get(user.id)?.length).toBe(
        friendRequests.length,
      );
      expect(entsMapFromUserVCToken.get(user2.id)?.length).toBe(0);
    });
  });
}
