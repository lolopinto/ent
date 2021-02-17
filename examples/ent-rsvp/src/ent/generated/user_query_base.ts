// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import { User, Event } from "src/ent/internal";
import { ID, Viewer, CustomEdgeQueryBase, query } from "@lolopinto/ent";

export class UserToEventsQueryBase extends CustomEdgeQueryBase<Event> {
  constructor(viewer: Viewer, src: User | ID) {
    let id: ID;
    if (typeof src === "object") {
      id = src.id;
    } else {
      id = src;
    }
    super(viewer, src, Event.loaderOptions(), query.Eq("creator_id", id));
  }

  static query<T extends UserToEventsQueryBase>(
    this: new (viewer: Viewer, src: User | ID) => T,
    viewer: Viewer,
    src: User | ID,
  ): T {
    return new this(viewer, src);
  }
}
