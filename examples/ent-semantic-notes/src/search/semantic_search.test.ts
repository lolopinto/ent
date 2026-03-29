import { buildQueryData } from "@snowtop/ent/core/query_impl";
import { buildSemanticChunkSearchQuery } from "src/search/semantic_search";

describe("semantic notes search", () => {
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
});
