import { type Data, IDViewer } from "@snowtop/ent";
import type { NoteCreateInput } from "../../generated/note/actions/create_note_action_base";
import { CreateNoteActionBase } from "../../generated/note/actions/create_note_action_base";

export type { NoteCreateInput };

export default class CreateNoteAction extends CreateNoteActionBase {
  viewerForEntLoad(data: Data) {
    return new IDViewer(data.id);
  }
}
