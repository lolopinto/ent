import {
  GraphQLFieldConfig,
  GraphQLID,
  GraphQLNonNull,
  GraphQLResolveInfo,
} from "graphql";
import { RequestContext } from "@snowtop/ent";
import { Account } from "src/ent/";
import { AccountType } from "src/graphql/resolvers/internal";

interface AccountQueryArgs {
  id: string;
}

export const AccountQueryType: GraphQLFieldConfig<
  undefined,
  RequestContext,
  AccountQueryArgs
> = {
  type: AccountType,
  args: {
    id: {
      description: "",
      type: GraphQLNonNull(GraphQLID),
    },
  },
  resolve: async (
    _source,
    args: AccountQueryArgs,
    context: RequestContext,
    _info: GraphQLResolveInfo,
  ) => {
    return Account.load(context.getViewer(), args.id);
  },
};
