import { DeleteAssignmentActionBase } from "../../generated/assignment/actions/delete_assignment_action_base";
import { deriveAssignment } from "./derive_assignment";

export default class DeleteAssignmentAction extends DeleteAssignmentActionBase {
  getTriggers() {
    return [{ changeset: deriveAssignment }];
  }
}
