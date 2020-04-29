import { Arg, Query, Resolver, Ctx, ID as GQLID } from "type-graphql";
import Contact from "src/ent/contact";
import { ID } from "ent/ent";
import { Context } from "src/graphql/context";

@Resolver((of) => Contact)
export default class ContactResolver {
  @Query((returns) => Contact, { nullable: true })
  async contact(
    @Ctx() ctx: Context,
    @Arg("id", (type) => GQLID) id: ID,
  ): Promise<Contact | null> {
    return await Contact.load(ctx.viewer, id);
  }
}
