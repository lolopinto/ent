/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

import {
  GraphQLFieldConfigMap,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
} from "graphql";
import { RequestContext } from "@snowtop/ent";
import { EmailInfo } from "../../../ent/contact_types";
import { ContactEmailType } from "../../resolvers/internal";
import { ExampleViewer as ExampleViewerAlias } from "../../../viewer/viewer";

export const EmailInfoType = new GraphQLObjectType({
  name: "EmailInfo",
  fields: (): GraphQLFieldConfigMap<
    EmailInfo,
    RequestContext<ExampleViewerAlias>
  > => ({
    emails: {
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(ContactEmailType)),
      ),
    },
    firstEmail: {
      type: new GraphQLNonNull(GraphQLString),
      resolve: (
        obj: EmailInfo,
        args: {},
        context: RequestContext<ExampleViewerAlias>,
      ) => {
        return obj.email1;
      },
    },
  }),
  isTypeOf(obj) {
    return obj instanceof EmailInfo;
  },
});
