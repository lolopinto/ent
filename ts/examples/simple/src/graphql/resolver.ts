import {
  Arg,
  FieldResolver,
  Query,
  Resolver,
  Root,
  Ctx,
  ID as GQLID,
} from "type-graphql";
import Contact from "src/ent/contact";
import User from "src/ent/user";
import { ID } from "ent/ent";
import { Context } from "./context";

@Resolver((of) => User)
export class UserResolver {
  @Query((returns) => User, { nullable: true })
  async user(
    @Ctx() ctx: Context,
    @Arg("id", (type) => GQLID) id: ID,
  ): Promise<User | null> {
    return await User.load(ctx.viewer, id);
  }
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
