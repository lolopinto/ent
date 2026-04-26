import { IDViewer } from "@snowtop/ent";
import type { NoteChunkCreateInput } from "src/ent/note_chunk/actions/create_note_chunk_action";
import CreateNoteAction from "src/ent/note/actions/create_note_action";
import NoteAddSavedByAction from "src/ent/note/actions/note_add_saved_by_action";
import CreateNoteChunkAction from "src/ent/note_chunk/actions/create_note_chunk_action";
import CreateUserAction from "src/ent/user/actions/create_user_action";
import CreateWorkspaceAction from "src/ent/workspace/actions/create_workspace_action";
import WorkspaceAddMemberAction from "src/ent/workspace/actions/workspace_add_member_action";
import { semanticChunkSearch } from "src/search/semantic_search";

const dbTest = process.env.POSTGRES_TEST_DB ? test : test.skip;
const bootstrapViewer = new IDViewer("semantic-notes-bootstrap");

function uniqueSuffix() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

describe("semantic notes search integration", () => {
  dbTest("creates semantic notes data and returns workspace-scoped nearest chunks", async () => {
    const suffix = uniqueSuffix();
    const queryEmbedding = [1, 0, 0, 0, 0, 0];

    const author = await CreateUserAction.create(bootstrapViewer, {
      name: `Author ${suffix}`,
      emailAddress: `author+${suffix}@example.com`,
    }).saveX();
    const member = await CreateUserAction.create(bootstrapViewer, {
      name: `Member ${suffix}`,
      emailAddress: `member+${suffix}@example.com`,
    }).saveX();

    const authorViewer = new IDViewer(author.id);

    const workspace = await CreateWorkspaceAction.create(authorViewer, {
      name: `Workspace ${suffix}`,
      slug: `workspace-${suffix}`,
      creatorId: author.id,
    }).saveX();
    await WorkspaceAddMemberAction.create(authorViewer, workspace)
      .addMember(member)
      .builder.saveX();

    const note = await CreateNoteAction.create(authorViewer, {
      workspaceId: workspace.id,
      authorId: author.id,
      title: `Semantic note ${suffix}`,
      body: "Chunk embeddings should be searchable inside one workspace",
      summary: "Vector search example",
    }).saveX();
    await NoteAddSavedByAction.create(authorViewer, note)
      .addSavedBy(member)
      .builder.saveX();

    const exactChunkInput: NoteChunkCreateInput = {
      noteId: note.id,
      workspaceId: workspace.id,
      ordinal: 0,
      content: `Exact match ${suffix}`,
      embedding: queryEmbedding as never,
    };
    const exactChunk = await CreateNoteChunkAction.create(
      authorViewer,
      exactChunkInput,
    ).saveX();
    const nearbyChunk = await CreateNoteChunkAction.create(authorViewer, {
      noteId: note.id,
      workspaceId: workspace.id,
      ordinal: 1,
      content: `Nearby match ${suffix}`,
      embedding: [0.96, 0.04, 0, 0, 0, 0] as never,
    }).saveX();

    const otherWorkspace = await CreateWorkspaceAction.create(authorViewer, {
      name: `Workspace filtered ${suffix}`,
      slug: `workspace-filtered-${suffix}`,
      creatorId: author.id,
    }).saveX();
    const otherNote = await CreateNoteAction.create(authorViewer, {
      workspaceId: otherWorkspace.id,
      authorId: author.id,
      title: `Filtered note ${suffix}`,
      body: "Should not appear in the search results",
    }).saveX();
    await CreateNoteChunkAction.create(authorViewer, {
      noteId: otherNote.id,
      workspaceId: otherWorkspace.id,
      ordinal: 0,
      content: `Filtered chunk ${suffix}`,
      embedding: queryEmbedding as never,
    }).saveX();

    const rows = await semanticChunkSearch({
      workspaceID: String(workspace.id),
      embedding: queryEmbedding,
      limit: 5,
      maxDistance: 0.05,
    });

    expect(rows.map((row) => row.id)).toEqual([exactChunk.id, nearbyChunk.id]);
    expect(rows.every((row) => row.workspace_id === String(workspace.id))).toBe(
      true,
    );
    expect(rows[0].distance).toBeCloseTo(0, 6);
    expect(rows[0].similarity).toBeCloseTo(1, 6);
    expect(rows[1].distance).toBeGreaterThan(rows[0].distance);

    const members = await workspace.queryMembers().queryIDs();
    expect(members).toEqual([member.id]);

    const savedBy = await note.querySavedBy().queryIDs();
    expect(savedBy).toEqual([member.id]);
  });
});
