import { CreateAssignmentActionBase } from "../../generated/assignment/actions/create_assignment_action_base";
import { deriveAssignment } from "./derive_assignment";

export type { AssignmentCreateInput } from "../../generated/assignment/actions/create_assignment_action_base";

export default class CreateAssignmentAction extends CreateAssignmentActionBase {
  getTriggers() {
    return [{ changeset: deriveAssignment }];
  }
}
