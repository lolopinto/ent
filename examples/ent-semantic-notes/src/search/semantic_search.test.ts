import * as ent from "@snowtop/ent";
import { buildQueryData } from "@snowtop/ent/core/query_impl";
import {
  buildSemanticChunkSearchQuery,
  semanticChunkSearch,
} from "src/search/semantic_search";
import globalSchema from "src/schema/__global__schema";

describe("semantic notes search", () => {
  test("declares pgvector in the example global schema", () => {
    expect(globalSchema.dbExtensions).toEqual([
      {
        name: "vector",
        provisionedBy: "ent",
        runtimeSchemas: ["public"],
        dropCascade: false,
      },
    ]);
  });

  test("builds a nearest-neighbor query over note chunks", () => {
    const queryData = buildQueryData(
      buildSemanticChunkSearchQuery({
        workspaceID: "workspace-1",
        embedding: [0.12, 0.3, 0.44, 0.08, 0.19, 0.71],
        limit: 3,
        maxDistance: 0.42,
      }),
    );

    expect(queryData.query).toBe(
      "SELECT id, note_id, workspace_id, ordinal, content, embedding <=> $1::vector AS distance, 1 - (embedding <=> $2::vector) AS similarity FROM note_chunks WHERE workspace_id = $3 AND embedding IS NOT NULL AND embedding <=> $4::vector < $5 ORDER BY embedding <=> $6::vector ASC LIMIT 3",
    );
    expect(queryData.values).toEqual([
      "[0.12,0.3,0.44,0.08,0.19,0.71]",
      "[0.12,0.3,0.44,0.08,0.19,0.71]",
      "workspace-1",
      "[0.12,0.3,0.44,0.08,0.19,0.71]",
      0.42,
      "[0.12,0.3,0.44,0.08,0.19,0.71]",
    ]);
  });

  test("semanticChunkSearch delegates through ent loadRows", async () => {
    const loadRowsSpy = jest
      .spyOn(ent, "loadRows")
      .mockResolvedValue([{ id: "chunk-1" }] as never);

    const options = {
      workspaceID: "workspace-1",
      embedding: [0.12, 0.3, 0.44, 0.08, 0.19, 0.71],
      limit: 2,
    };

    const rows = await semanticChunkSearch(options);
    const queryOptions = loadRowsSpy.mock.calls[0][0];

    expect(loadRowsSpy).toHaveBeenCalledTimes(1);
    expect(buildQueryData(queryOptions)).toEqual(
      buildQueryData(buildSemanticChunkSearchQuery(options)),
    );
    expect(rows).toEqual([{ id: "chunk-1" }]);
    loadRowsSpy.mockRestore();
  });
});
