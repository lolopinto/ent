import type { UserEditInput } from "../../generated/user/actions/edit_user_action_base";
import { EditUserActionBase } from "../../generated/user/actions/edit_user_action_base";

export type { UserEditInput };

export default class EditUserAction extends EditUserActionBase {}
