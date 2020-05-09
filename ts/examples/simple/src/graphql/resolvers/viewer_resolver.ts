import { Field as GQLField,ObjectType, Ctx, ID as GQLID, Resolver, Query } from "type-graphql";

import { Context } from "src/graphql/context";
import { Viewer as EntViewer } from "ent/ent";
import User from "src/ent/user";

@Resolver((of) => Viewer)
export default class ViewerResolver {
  @Query((returns) => Viewer, { nullable: true })
  async viewer(
    @Ctx() ctx: Context,
  ): Promise<Viewer> {
    return new Viewer(ctx.viewer);
  }
}

@ObjectType()
export class Viewer  {

  constructor(private viewer: EntViewer) { }
   
  @GQLField((type) => User, { name: "user", nullable:true})
  async user(): Promise<User | null> {
    if (!this.viewer.viewerID) {
      return null;
    }
    return User.load(this.viewer, this.viewer.viewerID);
  }
}