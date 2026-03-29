import type { NoteEditInput } from "../../generated/note/actions/edit_note_action_base";
import { EditNoteActionBase } from "../../generated/note/actions/edit_note_action_base";

export type { NoteEditInput };

export default class EditNoteAction extends EditNoteActionBase {}
