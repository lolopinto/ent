// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import { CustomEdgeQueryBase, ID, Viewer } from "@snowtop/ent";
import { Event, User } from "src/ent/internal";

export class UserToEventsQueryBase extends CustomEdgeQueryBase<
  User,
  Event,
  Viewer
> {
  constructor(viewer: Viewer, src: User | ID, sortColumn?: string) {
    super(viewer, {
      src: src,
      groupCol: "creator_id",
      loadEntOptions: Event.loaderOptions(),
      name: "UserToEventsQuery",
      sortColumn,
    });
  }

  static query<T extends UserToEventsQueryBase>(
    this: new (
      viewer: Viewer,
      src: User | ID,
    ) => T,
    viewer: Viewer,
    src: User | ID,
  ): T {
    return new this(viewer, src);
  }

  async sourceEnt(id: ID) {
    return User.load(this.viewer, id);
  }
}
