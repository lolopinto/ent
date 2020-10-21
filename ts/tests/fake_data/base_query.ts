import { Ent, Viewer } from "../../src/core/ent";
import {
  BaseEdgeQuery,
  EdgeQuery,
  EdgeQuerySource,
} from "../../src/core/query";
import { EdgeType, FakeUser, FakeContact, FakeEvent } from "./internal";

// TODO kill this
// these are useless without the other things written in there
export class BaseEventDestQuery<TSource extends Ent> extends BaseEdgeQuery<
  TSource,
  FakeEvent
> {
  constructor(viewer: Viewer, src: EdgeQuerySource<TSource>, edgeType: string) {
    super(viewer, src, edgeType, FakeEvent.loaderOptions());
  }
}

export class BaseUserDestQuery<TSource extends Ent> extends BaseEdgeQuery<
  TSource,
  FakeUser
> {
  constructor(viewer: Viewer, src: EdgeQuerySource<TSource>, edgeType: string) {
    super(viewer, src, edgeType, FakeUser.loaderOptions());
  }
}

interface ContactsDestQuery extends EdgeQuery<FakeContact> {}

interface UsersDestQuery extends EdgeQuery<FakeUser> {
  queryContacts(): ContactsDestQuery;
  queryFriends(): UsersDestQuery;
  queryHostedEvents(): EventsDestQuery;
  queryEventsAttending(): EventsDestQuery;
}

interface EventsDestQuery extends EdgeQuery<FakeEvent> {
  // at the end of the day, we want the inline one because of privacy
  // so here we have no choice but to write it all
  queryHosts(): UsersDestQuery;
  queryAttendees(): UsersDestQuery;
  queryInvited(): UsersDestQuery;
  queryDeclined(): UsersDestQuery;
  queryMaybe(): UsersDestQuery;
}
