import { CreateUserActionBase } from "../../generated/user/actions/create_user_action_base.js";
import type { UserCreateInput } from "../../generated/user/actions/create_user_action_base.js";
import { Data, IDViewer, AlwaysAllowPrivacyPolicy } from "@snowtop/ent";

export type { UserCreateInput };

// we're only writing this once except with --force and packageName provided
export default class CreateUserAction extends CreateUserActionBase {
  getPrivacyPolicy() {
    return AlwaysAllowPrivacyPolicy;
  }

  viewerForEntLoad(data: Data) {
    return new IDViewer(data.id);
  }
}
