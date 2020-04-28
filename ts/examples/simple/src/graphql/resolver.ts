import {
  Arg,
  FieldResolver,
  Query,
  Resolver,
  Root,
  ID as GQLID,
} from "type-graphql";
import User from "src/ent/user";
import { ID } from "ent/ent";
import { IDViewer } from "src/util/id_viewer";

@Resolver((of) => User)
export class UserResolver {
  @Query((returns) => User, { nullable: true })
  async userByID(@Arg("id", (type) => GQLID) id: ID): Promise<User | null> {
    return await User.load(new IDViewer(id), id);
  }
}
