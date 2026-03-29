import type { NoteCreateInput } from "../../generated/note/actions/create_note_action_base";
import { CreateNoteActionBase } from "../../generated/note/actions/create_note_action_base";

export type { NoteCreateInput };

export default class CreateNoteAction extends CreateNoteActionBase {}
