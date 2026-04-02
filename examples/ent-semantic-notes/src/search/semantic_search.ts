import { loadRows, query, type Clause, type QueryableDataOptions } from "@snowtop/ent";
import {
  cosineSimilarity,
  nearestNeighbor,
  withinDistance,
  type VectorLike,
} from "@snowtop/ent-pgvector";

export interface SemanticChunkSearchOptions {
  workspaceID: string;
  embedding: VectorLike;
  limit?: number;
  maxDistance?: number;
}

export interface SemanticChunkSearchRow {
  id: string;
  note_id: string;
  workspace_id: string;
  ordinal: number;
  content: string;
  distance: number;
  similarity: number;
}

export function buildSemanticChunkSearchClause(
  options: SemanticChunkSearchOptions,
): Clause {
  return query.And(
    query.Eq("workspace_id", options.workspaceID),
    query.NotEq("embedding", null),
    withinDistance(
      "embedding",
      options.embedding,
      options.maxDistance ?? 0.35,
      "cosine",
    ),
  );
}

export function buildSemanticChunkSearchQuery(
  options: SemanticChunkSearchOptions,
): QueryableDataOptions {
  const nearest = nearestNeighbor("embedding", options.embedding, {
    metric: "cosine",
    fieldAlias: "distance",
  });

  return {
    tableName: "note_chunks",
    fields: [
      "id",
      "note_id",
      "workspace_id",
      "ordinal",
      "content",
      nearest.field,
      {
        alias: "similarity",
        expression: cosineSimilarity("embedding", options.embedding, {
          key: "semantic_similarity",
        }),
      },
    ],
    clause: buildSemanticChunkSearchClause(options),
    orderby: [nearest.orderBy],
    limit: options.limit ?? 10,
  };
}

export async function semanticChunkSearch(
  options: SemanticChunkSearchOptions,
): Promise<SemanticChunkSearchRow[]> {
  const rows = await loadRows(buildSemanticChunkSearchQuery(options));
  return rows as SemanticChunkSearchRow[];
}
