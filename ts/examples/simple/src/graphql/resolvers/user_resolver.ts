import {
  Arg,
  Query,
  Mutation,
  Resolver,
  Ctx,
  Field as GQLField,
  ID as GQLID,
  ObjectType,
} from "type-graphql";
import User from "src/ent/user";
import { ID } from "ent/ent";
import { Context } from "src/graphql/context";
import CreateUserAction, {
  UserCreateInput,
} from "src/ent/user/actions/create_user_action";
import EditUserAction, {
  UserEditInput,
} from "src/ent/user/actions/edit_user_action";
import DeleteUserAction from "src/ent/user/actions/delete_user_action";

export default class UserResolver {
  @Query((returns) => User, { nullable: true, name: "user" })
  async user(
    @Ctx() ctx: Context,
    @Arg("id", (type) => GQLID) id: ID,
  ): Promise<User | null> {
    return await User.load(ctx.viewer, id);
  }

  @Mutation((returns) => User, { name: "userCreate" })
  async userCreate(
    @Ctx() ctx: Context,
    @Arg("input") input: UserCreateInput,
  ): Promise<User> {
    return CreateUserAction.create(ctx.viewer, input).saveX();
  }

  @Mutation((returns) => User, { nullable: true, name: "userEdit" })
  async userEdit(
    @Ctx() ctx: Context,
    @Arg("id", (type) => GQLID) id: ID,
    @Arg("input") input: UserEditInput,
  ): Promise<User | null> {
    let user = await User.load(ctx.viewer, id);
    if (!user) {
      return null;
    }
    // TODO produce a createFromID method....
    return EditUserAction.create(ctx.viewer, user, input).saveX();
  }

  @Mutation((returns) => UserDeleteResponse, { name: "userDelete" })
  async userDelete(
    @Ctx() ctx: Context,
    @Arg("id", (type) => GQLID) id: ID,
  ): Promise<UserDeleteResponse | null> {
    let user = await User.load(ctx.viewer, id);
    if (!user) {
      return null;
    }
    // TODO produce a createFromID method....
    await DeleteUserAction.create(ctx.viewer, user).saveX();
    return new UserDeleteResponse(id);
  }
}

@Resolver((of) => User)
@ObjectType()
class UserDeleteResponse {
  constructor(
    // TODO is it possible to do it all and decorate here?
    deletedUserID: ID,
  ) {
    this.deletedUserID = deletedUserID;
  }
  @GQLField((type) => GQLID)
  deletedUserID: ID;
}
