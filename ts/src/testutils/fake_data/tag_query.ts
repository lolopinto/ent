import { ID, Viewer } from "../../core/base";
import { CustomEdgeQueryBase } from "../../core/query/custom_query";
import { FakeUser, FakeTag } from "./internal";

export class UserToTagsFkeyQuery extends CustomEdgeQueryBase<
  FakeUser,
  FakeTag
> {
  constructor(viewer: Viewer, src: ID | FakeUser) {
    super(viewer, {
      src,
      loadEntOptions: FakeTag.loaderOptions(),
      groupCol: "owner_id",
      name: "user_to_tags",
      sortColumn: "canonical_name",
      sortColumnUnique: true,
    });
  }

  static query(viewer: Viewer, src: FakeUser | ID): UserToTagsFkeyQuery {
    return new UserToTagsFkeyQuery(viewer, src);
  }

  sourceEnt(id: ID) {
    return FakeUser.load(this.viewer, id);
  }
}

export class UserToTagsFkeyQueryAsc extends CustomEdgeQueryBase<
  FakeUser,
  FakeTag
> {
  constructor(viewer: Viewer, src: ID | FakeUser) {
    super(viewer, {
      src,
      loadEntOptions: FakeTag.loaderOptions(),
      groupCol: "owner_id",
      name: "user_to_tags_asc",
      sortColumn: "canonical_name ASC",
      sortColumnUnique: true,
    });
  }

  static query(viewer: Viewer, src: FakeUser | ID): UserToTagsFkeyQueryAsc {
    return new UserToTagsFkeyQueryAsc(viewer, src);
  }

  sourceEnt(id: ID) {
    return FakeUser.load(this.viewer, id);
  }
}
