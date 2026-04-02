import { type Data, IDViewer } from "@snowtop/ent";
import type { UserCreateInput } from "../../generated/user/actions/create_user_action_base";
import { CreateUserActionBase } from "../../generated/user/actions/create_user_action_base";

export type { UserCreateInput };

export default class CreateUserAction extends CreateUserActionBase {
  viewerForEntLoad(data: Data) {
    return new IDViewer(data.id);
  }
}
