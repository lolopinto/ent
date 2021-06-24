// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  AssocEdgeCountLoaderFactory,
  AssocEdgeLoaderFactory,
  AssocEdgeQueryBase,
  EdgeQuerySource,
  Viewer,
} from "@snowtop/snowtop-ts";
import {
  EdgeType,
  Tag,
  TagToTodosQuery,
  Todo,
  TodoToTagsEdge,
} from "src/ent/internal";

export const todoToTagsCountLoaderFactory = new AssocEdgeCountLoaderFactory(
  EdgeType.TodoToTags,
);
export const todoToTagsDataLoaderFactory = new AssocEdgeLoaderFactory(
  EdgeType.TodoToTags,
  () => TodoToTagsEdge,
);

export class TodoToTagsQueryBase extends AssocEdgeQueryBase<
  Todo,
  Tag,
  TodoToTagsEdge
> {
  constructor(viewer: Viewer, src: EdgeQuerySource<Todo>) {
    super(
      viewer,
      src,
      todoToTagsCountLoaderFactory,
      todoToTagsDataLoaderFactory,
      Tag.loaderOptions(),
    );
  }

  static query<T extends TodoToTagsQueryBase>(
    this: new (viewer: Viewer, src: EdgeQuerySource<Todo>) => T,
    viewer: Viewer,
    src: EdgeQuerySource<Todo>,
  ): T {
    return new this(viewer, src);
  }

  queryTodos(): TagToTodosQuery {
    return TagToTodosQuery.query(this.viewer, this);
  }
}
