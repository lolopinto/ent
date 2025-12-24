import { ID, Viewer } from "../../core/base.js";
import { CustomEdgeQueryBase } from "../../core/query/custom_query.js";
import { FakeUser, FakeTag } from "./internal.js";

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
      primarySortColIsUnique: true,
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
      orderby: [
        {
          column: "canonical_name",
          direction: "ASC",
        },
      ],
      primarySortColIsUnique: true,
    });
  }

  static query(viewer: Viewer, src: FakeUser | ID): UserToTagsFkeyQueryAsc {
    return new UserToTagsFkeyQueryAsc(viewer, src);
  }

  sourceEnt(id: ID) {
    return FakeUser.load(this.viewer, id);
  }
}
