// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  GraphQLFieldConfig,
  GraphQLFieldConfigMap,
  GraphQLID,
  GraphQLInputFieldConfigMap,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLResolveInfo,
  GraphQLString,
} from "graphql";
import { RequestContext, Viewer } from "@snowtop/ent";
import { Account } from "src/ent/";
import EditAccountAction, {
  AccountEditInput,
} from "src/ent/account/actions/edit_account_action";
import { AccountPrefs } from "src/ent/generated/types";
import { AccountPrefsInputType } from "src/graphql/generated/mutations/input/account_prefs_input_type";
import { AccountType } from "src/graphql/resolvers/";

interface customEditAccountInput
  extends Omit<
    AccountEditInput,
    "phoneNumber" | "accountPrefs" | "accountPrefs3" | "accountPrefsList"
  > {
  id: string;
  phone_number?: string;
  account_prefs?: AccountPrefs | null;
  account_prefs_3?: AccountPrefs;
  account_prefs_list?: AccountPrefs[] | null;
}

interface EditAccountPayload {
  account: Account;
}

export const EditAccountInputType = new GraphQLInputObjectType({
  name: "EditAccountInput",
  fields: (): GraphQLInputFieldConfigMap => ({
    id: {
      description: "id of Account",
      type: new GraphQLNonNull(GraphQLID),
    },
    name: {
      type: GraphQLString,
    },
    phone_number: {
      type: GraphQLString,
    },
    account_prefs: {
      type: AccountPrefsInputType,
    },
    account_prefs_3: {
      type: AccountPrefsInputType,
    },
    account_prefs_list: {
      type: new GraphQLList(new GraphQLNonNull(AccountPrefsInputType)),
    },
  }),
});

export const EditAccountPayloadType = new GraphQLObjectType({
  name: "EditAccountPayload",
  fields: (): GraphQLFieldConfigMap<
    EditAccountPayload,
    RequestContext<Viewer>
  > => ({
    account: {
      type: new GraphQLNonNull(AccountType),
    },
  }),
});

export const EditAccountType: GraphQLFieldConfig<
  undefined,
  RequestContext<Viewer>,
  { [input: string]: customEditAccountInput }
> = {
  type: new GraphQLNonNull(EditAccountPayloadType),
  args: {
    input: {
      description: "",
      type: new GraphQLNonNull(EditAccountInputType),
    },
  },
  resolve: async (
    _source,
    { input },
    context: RequestContext<Viewer>,
    _info: GraphQLResolveInfo,
  ): Promise<EditAccountPayload> => {
    const account = await EditAccountAction.saveXFromID(
      context.getViewer(),
      input.id,
      {
        name: input.name,
        phoneNumber: input.phone_number,
        accountPrefs: input.account_prefs,
        accountPrefs3: input.account_prefs_3,
        accountPrefsList: input.account_prefs_list,
      },
    );
    return { account };
  },
};
