import { GraphQLObjectType } from "graphql";

import { userCreateType } from "./user/create_user";
import { userEditType } from "./user/edit_user";
import { userDeleteType } from "./user/delete_user";

export const mutationType = new GraphQLObjectType({
  name: "Mutation",
  fields: () => ({
    userCreate: userCreateType,
    userEdit: userEditType,
    userDelete: userDeleteType,
  }),
});
