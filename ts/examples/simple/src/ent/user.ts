import {
  UserBase,
  UserCreateInput,
  UserEditInput,
  createUserFrom,
  editUserFrom,
  deleteUser,
} from "./generated/user_base";
import { ID, Viewer } from "ent/ent";
import {
  PrivacyPolicy,
  AllowIfViewerRule,
  AlwaysDenyRule,
  AllowIfViewerInboundEdgeExistsRule,
} from "ent/privacy";
import { AllowIfOmniRule } from "./../privacy/omni";
import { EdgeType } from "./const";

// we're only writing this once except with --force and packageName provided
export default class User extends UserBase {
  privacyPolicy: PrivacyPolicy = {
    rules: [
      AllowIfOmniRule,
      AllowIfViewerRule,
      new AllowIfViewerInboundEdgeExistsRule(EdgeType.UserToFriends),
      AlwaysDenyRule,
    ],
  };
}

// no actions yet so we support full create, edit, delete for now
export { UserCreateInput, UserEditInput, deleteUser };

export async function createUser(
  viewer: Viewer,
  input: UserCreateInput,
): Promise<User | null> {
  return createUserFrom(viewer, input, User);
}

export async function editUser(
  viewer: Viewer,
  id: ID,
  input: UserEditInput,
): Promise<User | null> {
  return editUserFrom(viewer, id, input, User);
}
