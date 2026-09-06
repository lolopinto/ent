import { EditAssignmentActionBase } from "../../generated/assignment/actions/edit_assignment_action_base";
import { deriveAssignment } from "./derive_assignment";

export type { AssignmentEditInput } from "../../generated/assignment/actions/edit_assignment_action_base";

export default class EditAssignmentAction extends EditAssignmentActionBase {
  getTriggers() {
    return [{ changeset: deriveAssignment }];
  }
}
