import { buildQueryData } from "@snowtop/ent";
import {
  HNSWIndex,
  IVFFlatIndex,
  PgVectorExtension,
  VectorType,
  cosineSimilarity,
  nearestNeighbor,
  parseVectorLiteral,
  pgvectorRuntimeHandler,
  serializeVector,
  withinDistance,
} from "./pgvector";

describe("ent-pgvector", () => {
  test("PgVectorExtension uses ergonomic defaults", () => {
    expect(PgVectorExtension()).toEqual({
      name: "vector",
      provisionedBy: "ent",
      runtimeSchemas: ["public"],
      dropCascade: false,
    });
  });

  test("VectorType validates and formats vectors", () => {
    const field = VectorType({ dimensions: 3 });
    expect(field.valid([1, 2, 3])).toBe(true);
    expect(field.valid([1, 2])).toBe(false);
    expect(field.format([1, 2, 3])).toBe("[1,2,3]");
    expect(() => field.format([1, Number.NaN, 3])).toThrow(
      /finite number/,
    );
    expect(serializeVector(new Float32Array([1, 2, 3]), 3)).toBe("[1,2,3]");
  });

  test("vector query helpers build expression-backed queries", () => {
    const nearest = nearestNeighbor("embedding", [0.1, 0.2, 0.3], {
      metric: "cosine",
      fieldAlias: "distance",
    });
    const similarity = cosineSimilarity("embedding", [0.1, 0.2, 0.3], {
      key: "similarity",
    });
    const queryData = buildQueryData({
      tableName: "note_chunks",
      alias: "nc",
      fields: ["id", nearest.field, { alias: "similarity", expression: similarity }],
      clause: withinDistance("embedding", [0.1, 0.2, 0.3], 0.45, "cosine"),
      orderby: [nearest.orderBy],
      limit: 5,
    });

    expect(queryData.query).toBe(
      "SELECT nc.id, nc.embedding <=> $1::vector AS distance, 1 - (nc.embedding <=> $2::vector) AS similarity FROM note_chunks AS nc WHERE nc.embedding <=> $3::vector < $4 ORDER BY nc.embedding <=> $5::vector ASC LIMIT 5",
    );
    expect(queryData.values).toEqual([
      "[0.1,0.2,0.3]",
      "[0.1,0.2,0.3]",
      "[0.1,0.2,0.3]",
      0.45,
      "[0.1,0.2,0.3]",
    ]);
  });

  test("index helpers produce shared-core metadata", () => {
    expect(
      HNSWIndex({
        name: "note_chunks_embedding_hnsw_idx",
        column: "embedding",
        metric: "cosine",
        m: 32,
        efConstruction: 96,
      }),
    ).toEqual({
      name: "note_chunks_embedding_hnsw_idx",
      columns: ["embedding"],
      indexType: "hnsw",
      ops: {
        embedding: "vector_cosine_ops",
      },
      indexParams: {
        m: 32,
        ef_construction: 96,
      },
      dbExtension: "vector",
      concurrently: undefined,
      where: undefined,
    });

    expect(
      IVFFlatIndex({
        name: "note_chunks_embedding_ivfflat_idx",
        column: "embedding",
        metric: "l2",
        lists: 128,
      }),
    ).toEqual({
      name: "note_chunks_embedding_ivfflat_idx",
      columns: ["embedding"],
      indexType: "ivfflat",
      ops: {
        embedding: "vector_l2_ops",
      },
      indexParams: {
        lists: 128,
      },
      dbExtension: "vector",
      concurrently: undefined,
      where: undefined,
    });
  });

  test("runtime handler exposes the core parser registration contract", () => {
    expect(pgvectorRuntimeHandler).toEqual({
      name: "vector",
      runtimeSchemas: ["public"],
      types: [
        {
          name: "vector",
          parse: parseVectorLiteral,
        },
      ],
    });
    expect(parseVectorLiteral("[4,5,6]")).toEqual([4, 5, 6]);
  });
});
