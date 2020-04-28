import {
  Arg,
  FieldResolver,
  Query,
  Mutation,
  Resolver,
  Root,
  Ctx,
  ID as GQLID,
} from "type-graphql";
import Contact from "src/ent/contact";
import User from "src/ent/user";
import { ID } from "ent/ent";
import { Context } from "./context";
import CreateUserAction, {
  UserCreateInput,
} from "src/ent/user/actions/create_user_action";
import EditUserAction, {
  UserEditInput,
} from "src/ent/user/actions/edit_user_action";
import DeleteUserAction from "src/ent/user/actions/delete_user_action";

@Resolver((of) => User)
export class UserResolver {
  @Query((returns) => User, { nullable: true })
  async user(
    @Ctx() ctx: Context,
    @Arg("id", (type) => GQLID) id: ID,
  ): Promise<User | null> {
    return await User.load(ctx.viewer, id);
  }

  @Mutation((returns) => User)
  async createUser(
    @Ctx() ctx: Context,
    @Arg("input") input: UserCreateInput,
  ): Promise<User> {
    return CreateUserAction.create(ctx.viewer, input).saveX();
  }

  @Mutation((returns) => User, { nullable: true })
  async editUser(
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

  // OTDO...
  // @Mutation()
  // async deleteUser(
  //   @Ctx() ctx: Context,
  //   @Arg("id", (type) => GQLID) id: ID,
  // ): Promise<void> {
  //   let user = await User.load(ctx.viewer, id);
  //   if (!user) {
  //     return;
  //   }
  //   // TODO produce a createFromID method....
  //   return DeleteUserAction.create(ctx.viewer, user).saveX();
  // }
}

@Resolver((of) => Contact)
export class ContactResolver {
  @Query((returns) => Contact, { nullable: true })
  async contact(
    @Ctx() ctx: Context,
    @Arg("id", (type) => GQLID) id: ID,
  ): Promise<Contact | null> {
    return await Contact.load(ctx.viewer, id);
  }
}
