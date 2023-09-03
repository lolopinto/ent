import { ID, Ent, Viewer, WriteOperation } from "../base";
import { AssocEdge, getDefaultLimit } from "../ent";
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
  UserToIncomingFriendRequestsQuery,
  ViewerWithAccessToken,
  FakeUserSchema,
  FakeEventSchema,
  EventToAttendeesQuery,
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
  addEdge,
  createEdges,
} from "../../testutils/fake_data/test_helpers";
import { MockLogs } from "../../testutils/mock_log";
import { And, Clause, Eq, Greater, GreaterEq, Less } from "../clause";
import { SimpleAction } from "../../testutils/builder";
import { DateTime } from "luxon";
import { convertDate } from "../convert";
import { TestContext } from "../../testutils/context/test_context";
import { getVerifyAfterEachCursorGeneric } from "../../testutils/query";

export function assocTests(ml: MockLogs, global = false) {
  ml.mock();

  // beforeAll(async () => {
  //   // TODO this is needed when we do only in a test here
  //   // need to figure this out
  //   await createEdges();
  // });

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

  function getWhereClause(query: any) {
    let execArray = /^SELECT (.+) FROM (.+) WHERE (.+)?/.exec(query.query);
    return execArray?.[3];
  }

  interface verifyQueryProps {
    length?: number;
    numQueries?: number;
    limit?: number;
    extraClause?: Clause;
    disablePaginationBump?: boolean;
    logsStart?: number;
    direction?: "ASC" | "DESC";
  }
  function verifyQuery({
    length = 1,
    numQueries = 1,
    limit = getDefaultLimit(),
    extraClause = undefined,
    disablePaginationBump = false,
    logsStart = 0,
    direction = "DESC",
  }: verifyQueryProps) {
    const clauses: Clause[] = [Eq("id1", ""), Eq("edge_type", "")];
    if (extraClause) {
      clauses.push(extraClause);
    }
    if (global) {
      clauses.push(Eq("deleted_at", null));
    }
    expect(ml.logs.length).toBe(length);
    for (let i = logsStart; i < numQueries; i++) {
      const whereClause = getWhereClause(ml.logs[i]);
      let expLimit = disablePaginationBump ? limit : limit + 1;

      expect(whereClause, `${i}`).toBe(
        // default limit
        `${And(...clauses).clause(
          1,
        )} ORDER BY time ${direction}, id2 ${direction} LIMIT ${expLimit}`,
      );
    }
  }

  function verifyCountQuery({ length = 1, numQueries = 1 }) {
    expect(ml.logs.length).toBe(length);
    for (let i = 0; i < numQueries; i++) {
      const whereClause = getWhereClause(ml.logs[i]);
      if (global) {
        expect(whereClause).toBe(
          `${And(
            Eq("id1", ""),
            Eq("edge_type", ""),
            Eq("deleted_at", null),
          ).clause(1)}`,
        );
      } else {
        expect(whereClause).toBe(
          `${And(Eq("id1", ""), Eq("edge_type", "")).clause(1)}`,
        );
      }
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
        createAllContacts({ input: { firstName: "Jon", lastName: "Snow" } }),
        createAllContacts({
          input: { firstName: "Aegon", lastName: "Targaryen" },
        }),
        createAllContacts({ input: { firstName: "Ned", lastName: "Stark" } }),
      ]);
      // modify contacts as needed
      user1[1] = this.ents(user1[1]);
      user2[1] = this.ents(user2[1]);
      user3[1] = this.ents(user3[1]);
      this.dataz = [user1, user2, user3];
      ml.clear();
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
        limit: this.limit || getDefaultLimit(),
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
        limit: this.limit || getDefaultLimit(),
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
        limit: this.limit || getDefaultLimit(),
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
        limit: this.limit || getDefaultLimit(),
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

  function validateQueryIntersectOrUnion(
    ml: MockLogs,
    user1: FakeUser,
    user2: FakeUser,
  ) {
    return function (_query, _cursor: string | undefined) {
      // 2 queries for user because privacy
      // 2 queries to fetch edges.
      expect(ml.logs.length).toBe(4);

      const where1 = getWhereClause(ml.logs[1]);
      const clauses1 = [
        Eq("id1", user1.id),
        Eq("edge_type", EdgeType.UserToFriends),
      ];
      const clauses2 = [
        Eq("id1", user2.id),
        Eq("edge_type", EdgeType.UserToFriends),
      ];
      if (global) {
        clauses1.push(Eq("deleted_at", null));
        clauses2.push(Eq("deleted_at", null));
      }
      const clause1 = And(...clauses1);
      expect(where1).toBe(`${clause1.clause(1)} ORDER BY time DESC LIMIT 1000`);
      expect(ml.logs[1].values).toStrictEqual(clause1.values());

      const where2 = getWhereClause(ml.logs[3]);
      const clause2 = And(...clauses2);
      // TODO 1001 vs 1000 here
      expect(where2).toBe(
        `${clause2.clause(1)} ORDER BY time DESC, id2 DESC LIMIT 1001`,
      );
      expect(ml.logs[3].values).toStrictEqual(clause2.values());
    };
  }

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
          return builder.editedEntX();
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

      ml.clear();
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
        limit: this.limit || getDefaultLimit(),
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
        limit: this.limit || getDefaultLimit(),
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
        limit: this.limit || getDefaultLimit(),
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
      //   limit: this.limit || getDefaultLimit(),
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
    beforeEach(async () => {
      [user, friendRequests] = await createUserPlusFriendRequests();
      [user2] = await createUserPlusFriendRequests();
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

    test("raw count", async () => {
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

  describe("time based queries", () => {
    let user: FakeUser;
    let contacts: FakeContact[];
    let ctx: TestContext;

    beforeEach(async () => {
      ctx = new TestContext();
      [user, contacts] = await createAllContacts({ ctx });
      const sortedTimes = contacts.map((c) => c.createdAt.getTime());

      expect(sortedTimes[1] - sortedTimes[0]).toBe(86400);
      expect(contacts.length).toBe(5);
      ml.clear();
      // to prime the cache
      await FakeUser.load(user.viewer, user.id);
    });

    function getQuery(viewer: Viewer) {
      return UserToContactsQuery.query(viewer, user.id);
    }

    test("ids", async () => {
      const ids = await getQuery(user.viewer).queryIDs();
      expect(ids.length).toBe(contacts.length);
    });

    test("before", async () => {
      const ids = await getQuery(user.viewer)
        .__beforeBETA(contacts[2].createdAt)
        .queryIDs();

      expect(ids.length).toBe(2);
      expect(ids).toEqual([contacts[1].id, contacts[0].id]);
      verifyQuery({
        length: 2,
        extraClause: Less("time", contacts[2].createdAt),
        // there's a load for user we don't care about here so just skip it...
        logsStart: 1,
        numQueries: 2,
      });
    });

    test("before + first", async () => {
      const ids = await getQuery(user.viewer)
        .__beforeBETA(contacts[2].createdAt)
        .first(1)
        .queryIDs();

      expect(ids.length).toBe(1);
      expect(ids).toEqual([contacts[1].id]);
      verifyQuery({
        length: 2,
        limit: 1,
        extraClause: Less("time", contacts[2].createdAt),
        // there's a load for user we don't care about here so just skip it...
        logsStart: 1,
        numQueries: 2,
      });
    });

    test("before + last", async () => {
      const ids = await getQuery(user.viewer)
        .__beforeBETA(contacts[2].createdAt)
        .last(1)
        .queryIDs();

      expect(ids.length).toBe(1);
      expect(ids).toEqual([contacts[0].id]);
      verifyQuery({
        length: 2,
        limit: 1,
        extraClause: Less("time", contacts[2].createdAt),
        // there's a load for user we don't care about here so just skip it...
        logsStart: 1,
        numQueries: 2,
        direction: "ASC",
      });
    });

    test("before + first with pagination", async () => {
      const query = getQuery(user.viewer);
      const edges = await query
        .__beforeBETA(contacts[2].createdAt)
        .first(1)
        .queryEdges();
      const pagination = query.paginationInfo();

      expect(edges.length).toBe(1);
      expect(edges.map((edge) => edge.id2)).toEqual([contacts[1].id]);
      verifyQuery({
        length: 2,
        limit: 1,
        extraClause: Less("time", contacts[2].createdAt),
        // there's a load for user we don't care about here so just skip it...
        logsStart: 1,
        numQueries: 2,
      });

      const info = pagination.get(user.id)!;
      expect(info.hasNextPage).toBe(true);
      expect(info.hasPreviousPage).toBe(false);

      ml.clear();

      const query2 = getQuery(user.viewer);
      const edges2 = await query2
        .__beforeBETA(contacts[2].createdAt)
        .first(1, info.endCursor)
        .queryEdges();
      const pagination2 = query2.paginationInfo();

      expect(edges2.length).toBe(1);
      expect(edges2.map((edge) => edge.id2)).toEqual([contacts[0].id]);

      // complicated pagination query. ignore verifying for now
      // verifyFirstAfterCursorQuery in shared_test handles this...

      const info2 = pagination2.get(user.id) ?? {
        hasNextPage: false,
        hasPreviousPage: false,
      };
      expect(info2.hasNextPage).toBe(false);
      expect(info2.hasPreviousPage).toBe(false);
    });

    test("after", async () => {
      const ids = await getQuery(user.viewer)
        .__afterBETA(contacts[2].createdAt)
        .queryIDs();
      expect(ids.length).toBe(2);
      expect(ids).toEqual([contacts[4].id, contacts[3].id]);

      verifyQuery({
        length: 2,
        extraClause: Greater("time", contacts[2].createdAt),
        // there's a load for user we don't care about here so just skip it...
        logsStart: 1,
        numQueries: 2,
      });
    });

    test("after + first", async () => {
      const ids = await getQuery(user.viewer)
        .__afterBETA(contacts[2].createdAt)
        .first(1)
        .queryIDs();
      expect(ids.length).toBe(1);
      expect(ids).toEqual([contacts[4].id]);

      verifyQuery({
        length: 2,
        limit: 1,
        extraClause: Greater("time", contacts[2].createdAt),
        // there's a load for user we don't care about here so just skip it...
        logsStart: 1,
        numQueries: 2,
      });
    });

    test("after + last", async () => {
      const ids = await getQuery(user.viewer)
        .__afterBETA(contacts[2].createdAt)
        .last(1)
        .queryIDs();
      expect(ids.length).toBe(1);
      expect(ids).toEqual([contacts[3].id]);

      verifyQuery({
        length: 2,
        limit: 1,
        extraClause: Greater("time", contacts[2].createdAt),
        // there's a load for user we don't care about here so just skip it...
        logsStart: 1,
        numQueries: 2,
        direction: "ASC",
      });
    });

    test("within", async () => {
      const ids = await getQuery(user.viewer)
        .__withinBeta(contacts[1].createdAt, contacts[4].createdAt)
        .queryIDs();
      expect(ids.length).toBe(3);
      expect(ids).toEqual([contacts[3].id, contacts[2].id, contacts[1].id]);

      verifyQuery({
        length: 2,
        extraClause: And(
          GreaterEq("time", contacts[1].createdAt),
          Less("time", contacts[4].createdAt),
        ),
        // there's a load for user we don't care about here so just skip it...
        logsStart: 1,
        numQueries: 2,
      });
    });

    test("within + first", async () => {
      const ids = await getQuery(user.viewer)
        .__withinBeta(contacts[1].createdAt, contacts[4].createdAt)
        .first(2)
        .queryIDs();
      expect(ids.length).toBe(2);
      expect(ids).toEqual([contacts[3].id, contacts[2].id]);

      verifyQuery({
        length: 2,
        limit: 2,
        extraClause: And(
          GreaterEq("time", contacts[1].createdAt),
          Less("time", contacts[4].createdAt),
        ),
        // there's a load for user we don't care about here so just skip it...
        logsStart: 1,
        numQueries: 2,
      });
    });

    test("within + last", async () => {
      const ids = await getQuery(user.viewer)
        .__withinBeta(contacts[1].createdAt, contacts[4].createdAt)
        .last(2)
        .queryIDs();
      expect(ids.length).toBe(2);
      expect(ids).toEqual([contacts[1].id, contacts[2].id]);

      verifyQuery({
        length: 2,
        limit: 2,
        extraClause: And(
          GreaterEq("time", contacts[1].createdAt),
          Less("time", contacts[4].createdAt),
        ),
        // there's a load for user we don't care about here so just skip it...
        logsStart: 1,
        numQueries: 2,
        direction: "ASC",
      });
    });

    test("within + first with pagination", async () => {
      const query = getQuery(user.viewer);
      const edges = await query
        .__withinBeta(contacts[1].createdAt, contacts[4].createdAt)
        .first(2)
        .queryEdges();
      const pagination = query.paginationInfo();

      expect(edges.length).toBe(2);
      expect(edges.map((edge) => edge.id2)).toEqual([
        contacts[3].id,
        contacts[2].id,
      ]);

      verifyQuery({
        length: 2,
        limit: 2,
        extraClause: And(
          GreaterEq("time", contacts[1].createdAt),
          Less("time", contacts[4].createdAt),
        ),
        // there's a load for user we don't care about here so just skip it...
        logsStart: 1,
        numQueries: 2,
      });

      const info = pagination.get(user.id)!;
      expect(info.hasNextPage).toBe(true);
      expect(info.hasPreviousPage).toBe(false);

      ml.clear();

      const query2 = getQuery(user.viewer);
      const edges2 = await query2
        .__withinBeta(contacts[1].createdAt, contacts[4].createdAt)
        .first(2, info.endCursor)
        .queryEdges();
      const pagination2 = query2.paginationInfo();

      expect(edges2.length).toBe(1);
      expect(edges2.map((edge) => edge.id2)).toEqual([contacts[1].id]);

      // complicated pagination query. ignore verifying for now
      // verifyFirstAfterCursorQuery in shared_test handles this...

      const info2 = pagination2.get(user.id) ?? {
        hasNextPage: false,
        hasPreviousPage: false,
      };
      expect(info2.hasNextPage).toBe(false);
      expect(info2.hasPreviousPage).toBe(false);
    });

    test("within + last with pagination", async () => {
      const query = getQuery(user.viewer);
      const edges = await query
        .__withinBeta(contacts[1].createdAt, contacts[4].createdAt)
        .last(2)
        .queryEdges();
      const pagination = query.paginationInfo();

      expect(edges.length).toBe(2);
      expect(edges.map((edge) => edge.id2)).toEqual([
        contacts[1].id,
        contacts[2].id,
      ]);

      verifyQuery({
        length: 2,
        limit: 2,
        extraClause: And(
          GreaterEq("time", contacts[1].createdAt),
          Less("time", contacts[4].createdAt),
        ),
        // there's a load for user we don't care about here so just skip it...
        logsStart: 1,
        numQueries: 2,
        direction: "ASC",
      });

      const info = pagination.get(user.id)!;
      expect(info.hasNextPage).toBe(false);
      expect(info.hasPreviousPage).toBe(true);

      ml.clear();

      const query2 = getQuery(user.viewer);
      const edges2 = await query2
        .__withinBeta(contacts[1].createdAt, contacts[4].createdAt)
        .last(2, info.endCursor)
        .queryEdges();
      const pagination2 = query2.paginationInfo();

      expect(edges2.length).toBe(1);
      expect(edges2.map((edge) => edge.id2)).toEqual([contacts[3].id]);

      // complicated pagination query. ignore verifying for now
      // verifyFirstAfterCursorQuery in shared_test handles this...

      const info2 = pagination2.get(user.id) ?? {
        hasNextPage: false,
        hasPreviousPage: false,
      };
      expect(info2.hasNextPage).toBe(false);
      expect(info2.hasPreviousPage).toBe(false);
    });
  });

  describe("intersect", () => {
    let users: FakeUser[] = [];
    let user1: FakeUser;
    let user2: FakeUser;

    beforeEach(async () => {
      users = [];
      for (let i = 0; i < 10; i++) {
        const user = await createTestUser();
        users.push(user);
      }

      for (let i = 0; i < 10; i++) {
        const user = users[i];
        // decreasing number of friends for each user
        const candidates = users
          .slice(0, 10 - i)
          .filter((u) => u.id != user.id);
        await addEdge(
          user,
          FakeUserSchema,
          EdgeType.UserToFriends,
          false,
          ...candidates,
        );
        const count = await UserToFriendsQuery.query(
          user.viewer,
          user,
        ).queryRawCount();
        expect(count, `${i}`).toBe(candidates.length);
      }

      user1 = users[0];
      user2 = users[1];
    });

    function getQuery() {
      return UserToFriendsQuery.query(user1.viewer, user1.id).__intersect(
        UserToFriendsQuery.query(user2.viewer, user2.id),
      );
    }

    function getCandidateIDs() {
      // not the first 2 since that's user1 and user2
      // not the last one since that's removed from user2's list of friends
      return users.slice(2, users.length - 1).map((u) => u.id);
    }

    test("ids", async () => {
      const ids = await getQuery().queryIDs();
      const candidates = getCandidateIDs();
      expect(ids.length).toBe(candidates.length);
      expect(ids.sort()).toStrictEqual(candidates.sort());
    });

    test("count", async () => {
      const count = await getQuery().queryCount();
      const candidates = getCandidateIDs();
      expect(count).toBe(candidates.length);
    });

    test("raw_count", async () => {
      const count = await getQuery().queryRawCount();
      // raw count doesn't include the intersection
      expect(count).toBe(users.length - 1);
    });

    test("edges", async () => {
      const edges = await getQuery().queryEdges();
      const candidates = getCandidateIDs();
      expect(edges.length).toBe(candidates.length);
      // for an intersect, the edge returned is always for the source id
      for (const edge of edges) {
        expect(edge.id1).toBe(user1.id);
      }
    });

    test("ents", async () => {
      const ents = await getQuery().queryEnts();
      const candidates = getCandidateIDs().sort();
      expect(ents.length).toBe(candidates.length);
      expect(ents.map((u) => u.id).sort()).toStrictEqual(candidates.sort());
    });

    test("first", async () => {
      const ents = await getQuery().first(2).queryEnts();
      expect(ents.length).toBe(2);
    });

    test("first. after each cursor", async () => {
      const edges = await getQuery().queryEdges();

      const { verify, getCursor } = getVerifyAfterEachCursorGeneric(
        edges,
        2,
        user1,
        getQuery,
        ml,
        validateQueryIntersectOrUnion(ml, user1, user2),
      );

      // this one intentionally not generic so we know where to stop...
      expect(edges.length).toBe(7);
      await verify(0, true, true, undefined);
      await verify(2, true, true, getCursor(edges[1]));
      await verify(4, true, true, getCursor(edges[3]));
      // 1 item, no nextPage
      await verify(6, true, false, getCursor(edges[5]));
      await verify(7, false, false, getCursor(edges[6]));
    });

    test("multiple intersections", async () => {
      const query = UserToFriendsQuery.query(
        user1.viewer,
        user1.id,
      ).__intersect(
        UserToFriendsQuery.query(user2.viewer, user2.id),
        UserToFriendsQuery.query(user2.viewer, users[2].id),
        UserToFriendsQuery.query(user2.viewer, users[3].id),
      );

      // user0 => 0-9 - self
      // user1 => 0-8 - self
      // user2 => 0-7 - self
      // user3 => 0-6 -self
      // 7 users - 4 = 3 since you can't be friends with yourself
      const candidates = [users[4], users[5], users[6]];
      const [ids, count, edges, ents] = await Promise.all([
        query.queryIDs(),
        query.queryCount(),
        query.queryEdges(),
        query.queryEnts(),
      ]);
      expect(ids.length).toBe(candidates.length);
      expect(count).toBe(candidates.length);
      expect(edges.length).toBe(candidates.length);
      expect(ents.length).toBe(candidates.length);
      expect(edges.map((e) => e.id2).sort()).toStrictEqual(
        candidates.map((u) => u.id).sort(),
      );
      expect(ents.map((e) => e.id).sort()).toStrictEqual(
        candidates.map((u) => u.id).sort(),
      );
    });

    test("multiple sources", async () => {
      const query = UserToFriendsQuery.query(user1.viewer, [
        user1.id,
        user2.id,
      ]).__intersect(
        UserToFriendsQuery.query(user2.viewer, users[2].id),
        UserToFriendsQuery.query(user2.viewer, users[3].id),
      );

      // user0 => 0-9 - self
      // user1 => 0-8 - self

      // user2 => 0-7 - self
      // user3 => 0-6 -self

      // 7 users - 3 = 4 since you can't be friends with yourself
      // subtracting 3 for each instead of 4 like above because user1 not intersecting with user2
      const candidates1 = [users[1], users[4], users[5], users[6]];
      const candidates2 = [users[0], users[4], users[5], users[6]];
      const [idsMap, countMap, edgesMap, entsMap] = await Promise.all([
        query.queryAllIDs(),
        query.queryAllCount(),
        query.queryAllEdges(),
        query.queryAllEnts(),
      ]);

      async function verify(source: FakeUser, candidates: FakeUser[]) {
        const ids = idsMap.get(source.id) ?? [];
        const count = countMap.get(source.id) ?? [];
        const edges = edgesMap.get(source.id) ?? [];
        const ents = entsMap.get(source.id) ?? [];

        expect(ids.length).toBe(candidates.length);
        expect(count).toBe(candidates.length);
        expect(edges.length).toBe(candidates.length);
        expect(ents.length).toBe(candidates.length);
        expect(edges.map((e) => e.id2).sort()).toStrictEqual(
          candidates.map((u) => u.id).sort(),
        );
        expect(ents.map((e) => e.id).sort()).toStrictEqual(
          candidates.map((u) => u.id).sort(),
        );
      }

      await verify(user1, candidates1);
      await verify(user2, candidates2);
    });

    test("different edge types", async () => {
      const event = await createTestEvent(user2);
      for (let i = 0; i < 5; i++) {
        const newUser = await createTestUser();
        await addEdge(
          event,
          FakeEventSchema,
          EdgeType.EventToAttendees,
          false,
          newUser,
        );
      }

      const query = UserToFriendsQuery.query(
        user1.viewer,
        user1.id,
      ).__intersect(EventToAttendeesQuery.query(user1.viewer, event.id));

      const count = await query.queryCount();
      expect(count).toBe(0);

      const candidates: FakeUser[] = [];
      for (let i = 0; i < users.length; i++) {
        const user = users[i];
        if (user.id !== user1.id && user.id !== user2.id) {
          await addEdge(
            event,
            FakeEventSchema,
            EdgeType.EventToAttendees,
            false,
            user,
          );
          candidates.push(user);
        }
      }

      const query2 = UserToFriendsQuery.query(
        user1.viewer,
        user1.id,
      ).__intersect(EventToAttendeesQuery.query(user1.viewer, event.id));

      const count2 = await query2.queryCount();
      const ents = await query2.queryEnts();
      const ids = await query2.queryIDs();
      expect(count2).toBe(candidates.length);
      expect(ids.length).toBe(candidates.length);
      expect(ents.length).toBe(candidates.length);
      expect(ents.map((e) => e.id).sort()).toStrictEqual(
        candidates.map((u) => u.id).sort(),
      );
    });
  });

  describe("union", () => {
    let users: FakeUser[] = [];
    let user1: FakeUser;
    let user2: FakeUser;
    let friends: Map<ID, FakeUser[]> = new Map();

    beforeEach(async () => {
      users = [];
      friends = new Map();
      for (let i = 0; i < 10; i++) {
        const user = await createTestUser();
        users.push(user);
      }

      for (let i = 0; i < 10; i++) {
        const user = users[i];
        // decreasing number of friends for each user

        // we want little overlap so new users created.
        const candidates = users
          .slice(0, 10 - i)
          .filter((u) => u.id != user.id);

        // add at least 5 more to each user
        // every user should end up with 14 or 15
        // 9 + 5 = 14
        // 8 + 6 = 14
        // 7 + 7 = 14
        // 6 + 8 = 14
        // 5 + 9 = 14
        // 4 + 10 = 14
        // 3 + 11 = 14
        // 2 + 12 = 14
        // 1 + 13 = 14
        // 0 + 14 = 14

        // 10 original
        // 5 new for friend 1
        // 6 new for friend 2
        const newFriends = await Promise.all(
          new Array(5 + i).fill(null).map(() => createTestUser()),
        );
        candidates.push(...newFriends);

        await addEdge(
          user,
          FakeUserSchema,
          EdgeType.UserToFriends,
          false,
          ...candidates,
        );
        const count = await UserToFriendsQuery.query(
          user.viewer,
          user,
        ).queryRawCount();
        expect(count, `${i}`).toBe(candidates.length);
        friends.set(user.id, candidates);
      }

      user1 = users[0];
      user2 = users[1];
    });

    function getQuery() {
      return UserToFriendsQuery.query(user1.viewer, user1.id).__union(
        UserToFriendsQuery.query(user2.viewer, user2.id),
      );
    }

    function getCandidateIDs() {
      const set = new Set<FakeUser>();
      friends.get(user1.id)?.forEach((u) => set.add(u));
      friends.get(user2.id)?.forEach((u) => set.add(u));

      return Array.from(set.values()).map((u) => u.id);
    }

    test("ids", async () => {
      const ids = await getQuery().queryIDs();
      const candidates = getCandidateIDs();
      expect(ids.length).toBe(candidates.length);
      expect(ids.sort()).toStrictEqual(candidates.sort());
    });

    test("count", async () => {
      const count = await getQuery().queryCount();
      const candidates = getCandidateIDs();
      expect(count).toBe(candidates.length);
    });

    test("raw_count", async () => {
      const count = await getQuery().queryRawCount();
      // raw count doesn't include the intersection
      expect(count).toBe(friends.get(user1.id)?.length);
    });

    test("edges", async () => {
      const edges = await getQuery().queryEdges();
      const candidates = getCandidateIDs();
      expect(edges.length).toBe(candidates.length);
      const idMap = new Map<ID, number>();

      for (const edge of edges) {
        const ct = (idMap.get(edge.id1) ?? 0) + 1;
        idMap.set(edge.id1, ct);
      }
      let id1count = friends.get(user1.id)?.length ?? 0;
      expect(idMap.get(user1.id)).toBe(id1count);
      expect(idMap.get(user2.id)).toBe(edges.length - id1count);
    });

    test("ents", async () => {
      // only returns privacy aware which is friends + self...
      const ents = await getQuery().queryEnts();
      const candidates = getCandidateIDs().sort();
      let id1count = friends.get(user1.id)?.length ?? 0;
      const visible = id1count + 1;

      expect(ents.length).toBe(visible);
    });

    test("first", async () => {
      const ents = await getQuery().first(2).queryEnts();
      expect(ents.length).toBe(2);
    });

    test("first. after each cursor", async () => {
      const edges = await getQuery().queryEdges();

      const { verify, getCursor } = getVerifyAfterEachCursorGeneric(
        edges,
        3,
        user1,
        getQuery,
        ml,
        validateQueryIntersectOrUnion(ml, user1, user2),
      );
      // hardcoded to test
      expect(edges.length).toBe(21);
      await verify(0, true, true, undefined);
      await verify(3, true, true, getCursor(edges[2]));
      await verify(6, true, true, getCursor(edges[5]));
      await verify(9, true, true, getCursor(edges[8]));
      await verify(12, true, true, getCursor(edges[11]));
      await verify(15, true, true, getCursor(edges[14]));
      await verify(18, true, true, getCursor(edges[17]));
      await verify(21, false, false, getCursor(edges[20]));
    });

    test("multiple unions", async () => {
      const user3 = users[2];
      const user4 = users[3];

      const query = UserToFriendsQuery.query(user1.viewer, user1.id).__union(
        UserToFriendsQuery.query(user1.viewer, user2.id),
        UserToFriendsQuery.query(user1.viewer, user3.id),
        UserToFriendsQuery.query(user1.viewer, user4.id),
      );
      const candidates = Array.from(
        new Set([
          ...(friends.get(user1.id) ?? []), // 0-9 (-self) + 5 friends
          ...(friends.get(user2.id) ?? []), // 0-9 (-self)  + 6 friends
          ...(friends.get(user3.id) ?? []), // 0-9 (-self) + 7 friends
          ...(friends.get(user4.id) ?? []), // 0-9 (-self) + 8 friends
        ]).values(),
      );
      // user1 can only see self + friends
      const user1Visible = friends.get(user1.id) ?? [];
      user1Visible.push(user1);

      // should be 36
      expect(candidates.length).toBe(10 + 5 + 6 + 7 + 8);
      const [ids, count, edges, ents] = await Promise.all([
        query.queryIDs(),
        query.queryCount(),
        query.queryEdges(),
        query.queryEnts(),
      ]);
      expect(ids.length).toBe(candidates.length);
      expect(count).toBe(candidates.length);
      expect(edges.length).toBe(candidates.length);
      expect(ents.length).toBe(user1Visible.length);
      expect(edges.map((e) => e.id2).sort()).toStrictEqual(
        candidates.map((u) => u.id).sort(),
      );
      expect(ents.map((e) => e.id).sort()).toStrictEqual(
        user1Visible.map((u) => u.id).sort(),
      );
    });

    test("multiple sources", async () => {
      const user3 = users[2];
      const user4 = users[3];

      const query = UserToFriendsQuery.query(user1.viewer, [
        user1.id,
        user2.id,
      ]).__union(
        UserToFriendsQuery.query(user2.viewer, user3.id),
        UserToFriendsQuery.query(user2.viewer, user4.id),
      );

      const candidates1 = Array.from(
        new Set([
          ...(friends.get(user1.id) ?? []), // 0-9 (-self) + 5 friends
          ...(friends.get(user3.id) ?? []), // 0-9 (-self) + 7 friends
          ...(friends.get(user4.id) ?? []), // 0-9 (-self) + 8 friends
        ]).values(),
      );
      const candidates2 = Array.from(
        new Set([
          ...(friends.get(user2.id) ?? []), // 0-9 (-self) + 6 friends
          ...(friends.get(user3.id) ?? []), // 0-9 (-self) + 7 friends
          ...(friends.get(user4.id) ?? []), // 0-9 (-self) + 8 friends
        ]).values(),
      );
      const [idsMap, countMap, edgesMap, entsMap] = await Promise.all([
        query.queryAllIDs(),
        query.queryAllCount(),
        query.queryAllEdges(),
        query.queryAllEnts(),
      ]);
      // user1 can only see self + friends
      const user1Visible = friends.get(user1.id) ?? [];
      user1Visible.push(user1);

      // since the EntQuery uses user1's viewer
      // can only see user2's friends that intersect with user1's friends
      // and that's every user except for the last user since we don't add that user to user2's friends
      const user2Visible = users.slice(0, users.length - 1);

      async function verify(
        source: FakeUser,
        candidates: FakeUser[],
        visible: FakeUser[],
      ) {
        const ids = idsMap.get(source.id) ?? [];
        const count = countMap.get(source.id) ?? [];
        const edges = edgesMap.get(source.id) ?? [];
        const ents = entsMap.get(source.id) ?? [];

        expect(ids.length).toBe(candidates.length);
        expect(count).toBe(candidates.length);
        expect(edges.length).toBe(candidates.length);
        expect(ents.length).toBe(visible.length);
        expect(edges.map((e) => e.id2).sort()).toStrictEqual(
          candidates.map((u) => u.id).sort(),
        );
        expect(ents.map((e) => e.id).sort()).toStrictEqual(
          visible.map((u) => u.id).sort(),
        );
      }

      await verify(user1, candidates1, user1Visible);
      await verify(user2, candidates2, user2Visible);
    });

    test("different edge types", async () => {
      const event = await createTestEvent(user2);
      const newUsers: FakeUser[] = [];
      for (let i = 0; i < 5; i++) {
        const newUser = await createTestUser();
        await addEdge(
          event,
          FakeEventSchema,
          EdgeType.EventToAttendees,
          false,
          newUser,
        );
        newUsers.push(newUser);
      }

      const query = UserToFriendsQuery.query(user1.viewer, user1.id).__union(
        EventToAttendeesQuery.query(user1.viewer, event.id),
      );

      const candidates = [
        ...(friends.get(user1.id) ?? []).map((u) => u.id),
        ...newUsers.map((u) => u.id),
      ];

      const count = await query.queryCount();
      expect(count).toBe(candidates.length);

      const ents = await query.queryEnts();
      const ids = await query.queryIDs();
      expect(ids.length).toBe(candidates.length);
      // can only see friends
      expect(ents.length).toBe(friends.get(user1.id)?.length);
    });
  });

  if (!global) {
    return;
  }

  // global only tests here

  describe("deleted edges", () => {
    let user: FakeUser;
    let friendRequests: FakeUser[];
    let user2: FakeUser;
    let postDeletedCount: number;

    beforeEach(async () => {
      [user, friendRequests] = await createUserPlusFriendRequests();
      user2 = await createTestUser();
      postDeletedCount = Math.floor(friendRequests.length / 2);
    });

    async function deleteEdges() {
      const action = new SimpleAction(
        user.viewer,
        FakeUserSchema,
        new Map(),
        WriteOperation.Edit,
        user,
      );
      for (let i = 0; i < friendRequests.length; i++) {
        if (i % 2 == 0) {
          action.builder.orchestrator.removeInboundEdge(
            friendRequests[i].id,
            EdgeType.UserToFriendRequests,
          );
        }
      }
      await action.saveX();
    }

    function getQuery(viewer: Viewer) {
      return UserToIncomingFriendRequestsQuery.query(viewer, user.id);
    }

    test("ids", async () => {
      const ids = await getQuery(user.viewer).queryIDs();
      expect(ids.length).toBe(friendRequests.length);
    });

    test("ids after deleted", async () => {
      await deleteEdges();
      const idsFromUser = await getQuery(user.viewer).queryIDs();
      expect(idsFromUser.length).toBe(postDeletedCount);
    });

    test("ids deleted. fetch deleted anyways", async () => {
      await deleteEdges();
      const idsFromUser = await getQuery(user.viewer)
        .withoutTransformations()
        .queryIDs();
      expect(idsFromUser.length).toBe(friendRequests.length);
    });

    test("count", async () => {
      const count = await getQuery(user.viewer).queryCount();
      expect(count).toBe(friendRequests.length);
    });

    test("count after deleted", async () => {
      await deleteEdges();
      const count = await getQuery(user.viewer).queryCount();
      expect(count).toBe(postDeletedCount);
    });

    test("count after deleted. fetch deleted", async () => {
      await deleteEdges();
      const count = await getQuery(user.viewer)
        .withoutTransformations()
        .queryCount();
      expect(count).toBe(friendRequests.length);
    });

    test("raw count", async () => {
      const count = await getQuery(user.viewer).queryCount();
      expect(count).toBe(friendRequests.length);
    });

    test("raw count after deleted", async () => {
      await deleteEdges();
      const count = await getQuery(user.viewer).queryRawCount();
      expect(count).toBe(postDeletedCount);
    });

    test("raw count after deleted. fetch deleted", async () => {
      await deleteEdges();
      const count = await getQuery(user.viewer)
        .withoutTransformations()
        .queryRawCount();
      expect(count).toBe(friendRequests.length);
    });

    test("edges", async () => {
      const edges = await getQuery(user.viewer).queryEdges();
      expect(edges.length).toBe(friendRequests.length);

      for (const edge of edges) {
        expect(edge.deleted_at).toBeNull();
      }
    });

    test("edges after deleted", async () => {
      await deleteEdges();
      const edges = await getQuery(user.viewer).queryEdges();
      expect(edges.length).toBe(postDeletedCount);

      for (const edge of edges) {
        expect(edge.deleted_at).toBeNull();
      }
    });

    test("edges after deleted. fetch deleted", async () => {
      await deleteEdges();
      const edges = await getQuery(user.viewer)
        .withoutTransformations()
        .queryEdges();
      expect(edges.length).toBe(friendRequests.length);

      let notDeletedAtCt = 0;
      for (const edge of edges) {
        if (edge.deleted_at === null) {
          notDeletedAtCt++;
        } else {
          expect(
            DateTime.fromJSDate(convertDate(edge.deleted_at)).isValid,
          ).toBe(true);
        }
      }
      expect(notDeletedAtCt).toBe(postDeletedCount);
    });

    test("ents", async () => {
      const viewer = new ViewerWithAccessToken(user.id, {
        tokens: {
          allow_incoming_friend_request: true,
        },
      });

      const ents = await getQuery(viewer).queryEnts();
      expect(ents.length).toBe(friendRequests.length);
    });

    test("ents after deleted", async () => {
      await deleteEdges();
      const viewer = new ViewerWithAccessToken(user.id, {
        tokens: {
          allow_incoming_friend_request: true,
        },
      });

      const ents = await getQuery(viewer).queryEnts();
      expect(ents.length).toBe(postDeletedCount);
    });

    test("ents after deleted. fetch deleted", async () => {
      await deleteEdges();
      const viewer = new ViewerWithAccessToken(user.id, {
        tokens: {
          allow_incoming_friend_request: true,
          always_allow_user: true,
        },
      });

      const ents = await getQuery(viewer).withoutTransformations().queryEnts();
      expect(ents.length).toBe(friendRequests.length);
    });
  });
}
