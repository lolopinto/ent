import { type Data, IDViewer } from "@snowtop/ent";
import type { NoteCreateInput } from "../../generated/note/actions/create_note_action_base.js";
import { CreateNoteActionBase } from "../../generated/note/actions/create_note_action_base.js";

export type { NoteCreateInput };

export default class CreateNoteAction extends CreateNoteActionBase {
  viewerForEntLoad(data: Data) {
    return new IDViewer(data.id);
  }
}
