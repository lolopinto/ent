import {
  ID,
  AssocEdge,
  Ent,
  Viewer,
  loadEdges,
  loadRawEdgeCountX,
  //  loadNodesByEdge,
  //  EntConstructor,
  LoadEntOptions,
  loadEnt,
  loadEnts,
  Edge,
} from "@lolopinto/ent";
import { Clause } from "@lolopinto/ent/core/query";
import { EdgeType } from "src/ent/const";
import Contact from "src/ent/contact";
import Event from "src/ent/event";
import User from "src/ent/user";

// TODO this doesn't belong here
export interface EdgeQuery<T extends Ent> {
  queryEdges(): Promise<Map<ID, AssocEdge[]>>;
  queryIDs(): Promise<Map<ID, ID[]>>;
  queryCount(): Promise<Map<ID, number>>;
  queryEnts(): Promise<Map<ID, T[]>>;
  //  limit(n: number): EdgeQuery<T>;
  // no offset/limit based
  firstN(n: number): EdgeQuery<T>;
  lastN(n: number): EdgeQuery<T>;
  // TODO
  beforeCursor(cursor: string, limit: number): EdgeQuery<T>;
  afterCursor(cursor: string, limit: number): EdgeQuery<T>;
  //  after
  // TODO where queries etc
  //  where(query.Cla)
  // TODO cursors

  // TODO we need a way to handle singular id for e.g. unique edge
  // we need a way to get
}

// TODO
interface UserQuery {
  //  queryEdges();
}

// filters that take ids, data and process things after the fact
// e.g. on ids
// let's start with that

// there should be 2 modes
interface EdgeQueryFilter {
  // this is a filter that does the processing in TypeScript instead of at the SQL layer
  filter?(edges: AssocEdge[]): AssocEdge[];
  // there's 2 ways to do it.
  // apply it in SQL
  // or process it after the fact
  // clauses that should be applied in SQL to change the query and do it after
  clauses?(): Clause[];

  // maybe it's a dynamic decision to do so and then clauses returns empty array and filter returns what was passed to it based on the decision flow
  //  preProcess
}

function assertPositive(n: number) {
  if (n < 0) {
    throw new Error("cannot use a negative number");
  }
}

class FirstNFilter implements EdgeQueryFilter {
  constructor(private n: number) {
    assertPositive(n);
  }

  filter(edges: AssocEdge[]): AssocEdge[] {
    return edges.slice(0, this.n);
  }
}

class LastNFilter implements EdgeQueryFilter {
  constructor(private n: number) {
    assertPositive(n);
  }

  filter(edges: AssocEdge[]): AssocEdge[] {
    return edges.slice(edges.length - this.n, this.n);
  }
}

class AfterCursor implements EdgeQueryFilter {
  constructor(private cursor: string, private limit: number) {}

  filter(edges: AssocEdge[]): AssocEdge[] {
    return edges;
  }

  clauses(): Clause[] {
    return [];
  }
}

// support paging back
// make this optional...

// TODO provide ways to parse cursor and handle this in the future
class BeforeCursor implements EdgeQueryFilter {
  constructor(private cursor: string, private limit: number) {}

  filter(edges: AssocEdge[]): AssocEdge[] {
    return edges;
  }

  clauses(): Clause[] {
    return [];
  }
}

type EdgeQuerySource<T extends Ent> = T | T[] | ID | ID[] | EdgeQuery<T>;

class BaseEdgeQuery<TSource extends Ent, TDest extends Ent> {
  private filters: EdgeQueryFilter[] = [];
  private queryDispatched: boolean;
  private idsResolved: boolean;
  private edges: Map<ID, AssocEdge[]> = new Map();
  private resolvedIDs: ID[] = [];

  constructor(
    public viewer: Viewer,
    private src: EdgeQuerySource<TSource>,
    private edgeType: string,
    private ctr: LoadEntOptions<TDest>,
  ) {}

  // TODO memoization...
  private async resolveIDs(): Promise<ID[]> {
    if (this.idsResolved) {
      //      return this.resolvedIDs;
    }
    if (Array.isArray(this.src)) {
      this.src.forEach((obj: TSource | ID) => this.addID(obj));
    } else if (this.isEdgeQuery(this.src)) {
      console.log("isEdgeQuery");
      const idsMap = await this.src.queryIDs();
      console.log("idsMap", idsMap);
      for (const [_, ids] of idsMap) {
        ids.forEach((id) => this.resolvedIDs.push(id));
      }
    } else {
      this.addID(this.src);
    }
    this.idsResolved = true;
    return this.resolvedIDs;
  }

  private isEdgeQuery(
    obj: TSource | ID | EdgeQuery<TSource>,
  ): obj is EdgeQuery<TSource> {
    if ((obj as EdgeQuery<TSource>).queryIDs !== undefined) {
      return true;
    }
    return false;
  }

  private addID(obj: TSource | ID) {
    if (typeof obj === "object") {
      this.resolvedIDs.push(obj.id);
    } else {
      this.resolvedIDs.push(obj);
    }
  }

  firstN(n: number): this {
    this.filters.push(new FirstNFilter(n));
    return this;
  }

  lastN(n: number): this {
    this.filters.push(new LastNFilter(n));
    return this;
  }

  beforeCursor(cursor: string, n: number): this {
    this.filters.push(new BeforeCursor(cursor, n));
    return this;
  }

  afterCursor(cursor: string, n: number): this {
    this.filters.push(new AfterCursor(cursor, n));
    return this;
  }

  async queryEdges(): Promise<Map<ID, AssocEdge[]>> {
    return await this.loadEdges();
  }

  async queryIDs(): Promise<Map<ID, ID[]>> {
    const edges = await this.loadEdges();
    let results: Map<ID, ID[]> = new Map();
    for (const [id, edge_data] of edges) {
      results.set(
        id,
        edge_data.map((edge) => edge.id2),
      );
    }
    console.log("queryIDs", results);
    return results;
  }

  // doesn't work with filters...
  async queryCount(): Promise<Map<ID, number>> {
    let results: Map<ID, number> = new Map();
    const ids = await this.resolveIDs();
    console.log("ids", ids);
    await Promise.all(
      ids.map(async (id) => {
        const count = await loadRawEdgeCountX({
          id1: id,
          edgeType: this.edgeType,
          context: this.viewer.context,
        });
        results.set(id, count);
      }),
    );
    return results;
  }

  async queryEnts(): Promise<Map<ID, TDest[]>> {
    // applies filters and then gets things after
    const edges = await this.loadEdges();
    let promises: Promise<any>[] = [];
    const results: Map<ID, TDest[]> = new Map();

    const loadEntsForID = async (id: ID, edges: AssocEdge[]) => {
      const ids = edges.map((edge) => edge.id2);
      const ents = await loadEnts(this.viewer, this.ctr, ...ids);
      results.set(id, ents);
    };

    for (const [id, edgesList] of edges) {
      promises.push(loadEntsForID(id, edgesList));
    }

    await Promise.all(promises);
    return results;
  }

  private async loadRawEdges() {
    const ids = await this.resolveIDs();
    await Promise.all(
      ids.map(async (id) => {
        const edges = await loadEdges({
          id1: id,
          edgeType: this.edgeType,
          context: this.viewer.context,
        });
        this.edges.set(id, edges);
      }),
    );
  }

  private async loadEdges() {
    if (this.queryDispatched) {
      return this.edges;
    }
    // TODO how does one memoize this call?
    this.queryDispatched = true;

    this.filters.forEach((filter) => {
      let clauses: Clause[] | undefined;
      if (filter.clauses) {
        clauses = filter.clauses();
        if (clauses?.length) {
          throw new Error("unsupported for now. can't have extra clauses");
        }
      }
    });

    await this.loadRawEdges();

    // no filters. nothing to do here.
    if (!this.filters.length) {
      return this.edges;
    }

    // filter as needed
    for (let [id, edges] of this.edges) {
      this.filters.forEach((filter) => {
        if (filter.filter) {
          edges = filter.filter(edges);
        }
      });
      this.edges.set(id, edges);
    }
    return this.edges;
  }
}

// TODO: are these interfaces useful?
interface EventsQuery {
  // how do we make this general?
  queryHosts(): EventToHostsQuery;
  queryInvited(): EventToInvitedQuery;
  queryAttending(): EventToAttendingQuery;
  queryDeclined(): EventToDeclinedQuery;
  queryMaybe(): EventToMaybeQuery;
}

interface UserQuery {
  queryCreatedEvents(): UserToCreatedEventsQuery;
  queryFriends(): UserToFriendsQuery;
  queryInvitedEvents(): UserToInvitedEventsQuery;
  queryEventsAttending(): UserToEventsAttendingQuery;
  queryDeclinedEvents(): UserToDeclinedEventsQuery;
  queryMaybeEvents(): UserToMaybeEventsQuery;
  querySelfContact(): UserToSelfContactQuery;
}

class BaseEventsDestQuery<TSource extends Ent>
  extends BaseEdgeQuery<TSource, Event>
  implements EventsQuery {
  //  constructor(viewer: Viewer, src: EdgeQuerySource<Event>) {}

  // static query(viewer: Viewer, src: EdgeQuerySource<Event>): BaseEventsQuery {
  //   return new BaseEventsQuery(viewer, src);
  // }

  queryHosts(): EventToHostsQuery {
    return new EventToHostsQuery(this.viewer, this);
  }

  queryInvited(): EventToInvitedQuery {
    return new EventToInvitedQuery(this.viewer, this);
  }

  queryMaybe(): EventToInvitedQuery {
    return new EventToMaybeQuery(this.viewer, this);
  }

  queryAttending(): EventToAttendingQuery {
    return new EventToAttendingQuery(this.viewer, this);
  }

  queryDeclined(): EventToInvitedQuery {
    return new EventToDeclinedQuery(this.viewer, this);
  }
}

class BaseUserDestQuery<TSource extends Ent>
  extends BaseEdgeQuery<TSource, User>
  implements UserQuery {
  //  constructor(viewer: Viewer, src: EdgeQuerySource<Event>) {}

  // static query(viewer: Viewer, src: EdgeQuerySource<Event>): BaseEventsQuery {
  //   return new BaseEventsQuery(viewer, src);
  // }

  queryCreatedEvents(): UserToCreatedEventsQuery {
    return new UserToCreatedEventsQuery(this.viewer, this);
  }

  queryFriends(): UserToFriendsQuery {
    return new UserToFriendsQuery(this.viewer, this);
  }

  queryInvitedEvents(): UserToInvitedEventsQuery {
    return new UserToInvitedEventsQuery(this.viewer, this);
  }

  queryEventsAttending(): UserToEventsAttendingQuery {
    return new UserToEventsAttendingQuery(this.viewer, this);
  }

  queryDeclinedEvents(): UserToDeclinedEventsQuery {
    return new UserToDeclinedEventsQuery(this.viewer, this);
  }

  queryMaybeEvents(): UserToMaybeEventsQuery {
    return new UserToMaybeEventsQuery(this.viewer, this);
  }

  querySelfContact(): UserToSelfContactQuery {
    return new UserToSelfContactQuery(this.viewer, this);
  }
}

class BaseContactsDestQuery<TSource extends Ent> extends BaseEdgeQuery<
  TSource,
  Contact
> {}

export class UserToCreatedEventsQuery extends BaseEventsDestQuery<User> {
  constructor(viewer: Viewer, src: EdgeQuerySource<User>) {
    super(viewer, src, EdgeType.UserToCreatedEvents, Event.loaderOptions());
  }

  static query(
    viewer: Viewer,
    src: EdgeQuerySource<User>,
  ): UserToCreatedEventsQuery {
    return new UserToCreatedEventsQuery(viewer, src);
  }

  // Event to XXX
  // we want queryHosts
  // queryInvited,
  // queryAttending etc here
  // queryHosts(): EventToHostsQuery {
  //   return new EventToHostsQuery(this.viewer, this);
  // }

  // queryInvited(): EventToInvitedQuery {
  //   return new EventToInvitedQuery(this.viewer, this);
  // }

  // queryMaybe(): EventToInvitedQuery {
  //   return new EventToMaybeQuery(this.viewer, this);
  // }

  // queryAttending(): EventToInvitedQuery {
  //   return new EventToAttendingQuery(this.viewer, this);
  // }

  // queryDeclining(): EventToInvitedQuery {
  //   return new EventToDeclinedQuery(this.viewer, this);
  // }

  // queryAttending(): UserQuery;
  // queryDeclined(): UserQuery;
  // queryMaybe(): UserQuery;
}

export class UserToDeclinedEventsQuery extends BaseEventsDestQuery<User> {
  constructor(viewer: Viewer, src: EdgeQuerySource<User>) {
    super(viewer, src, EdgeType.UserToDeclinedEvents, Event.loaderOptions());
  }

  static query(
    viewer: Viewer,
    src: EdgeQuerySource<User>,
  ): UserToDeclinedEventsQuery {
    return new UserToDeclinedEventsQuery(viewer, src);
  }
}

export class UserToEventsAttendingQuery extends BaseEventsDestQuery<User> {
  constructor(viewer: Viewer, src: EdgeQuerySource<User>) {
    super(viewer, src, EdgeType.UserToEventsAttending, Event.loaderOptions());
  }

  static query(
    viewer: Viewer,
    src: EdgeQuerySource<User>,
  ): UserToEventsAttendingQuery {
    return new UserToEventsAttendingQuery(viewer, src);
  }
}

export class UserToFriendsQuery extends BaseEdgeQuery<User, User> {
  constructor(viewer: Viewer, src: EdgeQuerySource<User>) {
    super(viewer, src, EdgeType.UserToFriends, User.loaderOptions());
  }

  static query(viewer: Viewer, src: EdgeQuerySource<User>): UserToFriendsQuery {
    return new UserToFriendsQuery(viewer, src);
  }
}

export class UserToInvitedEventsQuery extends BaseEventsDestQuery<User> {
  constructor(viewer: Viewer, src: EdgeQuerySource<User>) {
    super(viewer, src, EdgeType.UserToInvitedEvents, Event.loaderOptions());
  }

  static query(
    viewer: Viewer,
    src: EdgeQuerySource<User>,
  ): UserToInvitedEventsQuery {
    return new UserToInvitedEventsQuery(viewer, src);
  }
}

export class UserToMaybeEventsQuery extends BaseEventsDestQuery<User> {
  constructor(viewer: Viewer, src: EdgeQuerySource<User>) {
    super(viewer, src, EdgeType.UserToMaybeEvents, Event.loaderOptions());
  }

  static query(
    viewer: Viewer,
    src: EdgeQuerySource<User>,
  ): UserToMaybeEventsQuery {
    return new UserToMaybeEventsQuery(viewer, src);
  }
}

export class EventToHostsQuery extends BaseUserDestQuery<Event> {
  constructor(viewer: Viewer, src: EdgeQuerySource<Event>) {
    super(viewer, src, EdgeType.EventToHosts, User.loaderOptions());
  }

  static query(viewer: Viewer, src: EdgeQuerySource<Event>): EventToHostsQuery {
    return new EventToHostsQuery(viewer, src);
  }
}

export class EventToAttendingQuery extends BaseUserDestQuery<Event> {
  constructor(viewer: Viewer, src: EdgeQuerySource<Event>) {
    super(viewer, src, EdgeType.EventToAttending, User.loaderOptions());
  }

  static query(
    viewer: Viewer,
    src: EdgeQuerySource<Event>,
  ): EventToAttendingQuery {
    return new EventToAttendingQuery(viewer, src);
  }
}

export class EventToDeclinedQuery extends BaseUserDestQuery<Event> {
  constructor(viewer: Viewer, src: EdgeQuerySource<Event>) {
    super(viewer, src, EdgeType.EventToDeclined, User.loaderOptions());
  }

  static query(
    viewer: Viewer,
    src: EdgeQuerySource<Event>,
  ): EventToDeclinedQuery {
    return new EventToDeclinedQuery(viewer, src);
  }
}

export class EventToInvitedQuery extends BaseUserDestQuery<Event> {
  constructor(viewer: Viewer, src: EdgeQuerySource<Event>) {
    super(viewer, src, EdgeType.EventToInvited, User.loaderOptions());
  }

  static query(
    viewer: Viewer,
    src: EdgeQuerySource<Event>,
  ): EventToInvitedQuery {
    return new EventToInvitedQuery(viewer, src);
  }
}

export class EventToMaybeQuery extends BaseUserDestQuery<Event> {
  constructor(viewer: Viewer, src: EdgeQuerySource<Event>) {
    super(viewer, src, EdgeType.EventToMaybe, User.loaderOptions());
  }

  static query(viewer: Viewer, src: EdgeQuerySource<Event>): EventToMaybeQuery {
    return new EventToMaybeQuery(viewer, src);
  }
}

export class UserToSelfContactQuery extends BaseContactsDestQuery<User> {
  constructor(viewer: Viewer, src: EdgeQuerySource<User>) {
    super(viewer, src, EdgeType.UserToSelfContact, Contact.loaderOptions());
  }

  static query(
    viewer: Viewer,
    src: EdgeQuerySource<User>,
  ): UserToSelfContactQuery {
    return new UserToSelfContactQuery(viewer, src);
  }
}

// whereHAsEdge
// whereEdgeDoesNotExist
// where(P::predicate) etc
// intersect()
// difference()
// etc

// e.g. mutualFriends => friends 1 -> intersect friends 2

// mixin?

// TODO come back to this...
