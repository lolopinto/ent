import { type Data, IDViewer } from "@snowtop/ent";
import type { NoteChunkCreateInput } from "../../generated/note_chunk/actions/create_note_chunk_action_base";
import { CreateNoteChunkActionBase } from "../../generated/note_chunk/actions/create_note_chunk_action_base";

export type { NoteChunkCreateInput };

export default class CreateNoteChunkAction extends CreateNoteChunkActionBase {
  viewerForEntLoad(data: Data) {
    return new IDViewer(data.id);
  }
}
