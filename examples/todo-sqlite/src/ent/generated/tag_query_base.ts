// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  AssocEdgeCountLoaderFactory,
  AssocEdgeLoaderFactory,
  AssocEdgeQueryBase,
  EdgeQuerySource,
  ID,
  Viewer,
} from "@snowtop/ent";
import {
  EdgeType,
  Tag,
  TagToTodosEdge,
  Todo,
  TodoToTagsQuery,
} from "src/ent/internal";

export const tagToTodosCountLoaderFactory = new AssocEdgeCountLoaderFactory(
  EdgeType.TagToTodos,
);
export const tagToTodosDataLoaderFactory = new AssocEdgeLoaderFactory(
  EdgeType.TagToTodos,
  () => TagToTodosEdge,
);

export abstract class TagToTodosQueryBase extends AssocEdgeQueryBase<
  Tag,
  Todo,
  TagToTodosEdge,
  Viewer
> {
  constructor(viewer: Viewer, src: EdgeQuerySource<Tag, Todo, Viewer>) {
    super(
      viewer,
      src,
      tagToTodosCountLoaderFactory,
      tagToTodosDataLoaderFactory,
      Todo.loaderOptions(),
    );
  }

  static query<T extends TagToTodosQueryBase>(
    this: new (viewer: Viewer, src: EdgeQuerySource<Tag, Todo>) => T,
    viewer: Viewer,
    src: EdgeQuerySource<Tag, Todo>,
  ): T {
    return new this(viewer, src);
  }

  sourceEnt(id: ID) {
    return Tag.load(this.viewer, id);
  }

  queryTags(): TodoToTagsQuery {
    return TodoToTagsQuery.query(this.viewer, this);
  }
}
