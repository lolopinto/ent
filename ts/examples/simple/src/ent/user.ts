import {
  UserBase,
  UserCreateInput,
  UserEditInput,
  createUserFrom,
  editUserFrom,
  deleteUser,
} from "./generated/user_base";
import { ID, Viewer } from "ent/ent";
import { PrivacyPolicy, AllowIfViewerRule, AlwaysDenyRule } from "ent/privacy";

// we're only writing this once except with --force and packageName provided
export default class User extends UserBase {
  privacyPolicy: PrivacyPolicy = {
    rules: [AllowIfViewerRule, AlwaysDenyRule],
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
