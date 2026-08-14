import type { NoteEditInput } from "../../generated/note/actions/edit_note_action_base.js";
import { EditNoteActionBase } from "../../generated/note/actions/edit_note_action_base.js";

export type { NoteEditInput };

export default class EditNoteAction extends EditNoteActionBase {}
