import type { UserEditInput } from "../../generated/user/actions/edit_user_action_base.js";
import { EditUserActionBase } from "../../generated/user/actions/edit_user_action_base.js";

export type { UserEditInput };

export default class EditUserAction extends EditUserActionBase {}
