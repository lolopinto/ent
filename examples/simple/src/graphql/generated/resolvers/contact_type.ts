/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

import {
  GraphQLFieldConfigMap,
  GraphQLID,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
} from "graphql";
import { RequestContext } from "@snowtop/ent";
import {
  GraphQLEdgeConnection,
  GraphQLNodeInterface,
  nodeIDEncoder,
} from "@snowtop/ent/graphql";
import {
  Contact,
  ContactCommentsFromAttachmentQuery,
  ContactToCommentsQuery,
  ContactToLikersQuery,
} from "../../../ent";
import {
  ContactCommentsFromAttachmentConnectionType,
  ContactEmailType,
  ContactItemFilterType,
  ContactItemResultType,
  ContactPhoneNumberType,
  ContactToCommentsConnectionType,
  ContactToLikersConnectionType,
  UserType,
} from "../../resolvers/internal";
import { ExampleViewer as ExampleViewerAlias } from "../../../viewer/viewer";
import { EmailInfo } from "../../../ent/contact";

export const ContactType = new GraphQLObjectType({
  name: "Contact",
  fields: (): GraphQLFieldConfigMap<
    Contact,
    RequestContext<ExampleViewerAlias>
  > => ({
    emails: {
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(ContactEmailType)),
      ),
      resolve: (
        obj: Contact,
        args: {},
        context: RequestContext<ExampleViewerAlias>,
      ) => {
        return obj.loadEmails();
      },
    },
    phoneNumbers: {
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(ContactPhoneNumberType)),
      ),
      resolve: (
        obj: Contact,
        args: {},
        context: RequestContext<ExampleViewerAlias>,
      ) => {
        return obj.loadPhoneNumbers();
      },
    },
    user: {
      type: UserType,
      resolve: (
        obj: Contact,
        args: {},
        context: RequestContext<ExampleViewerAlias>,
      ) => {
        return obj.loadUser();
      },
    },
    id: {
      type: new GraphQLNonNull(GraphQLID),
      resolve: nodeIDEncoder,
    },
    firstName: {
      type: new GraphQLNonNull(GraphQLString),
    },
    lastName: {
      type: new GraphQLNonNull(GraphQLString),
    },
    comments: {
      type: new GraphQLNonNull(ContactToCommentsConnectionType()),
      args: {
        first: {
          description: "",
          type: GraphQLInt,
        },
        after: {
          description: "",
          type: GraphQLString,
        },
        last: {
          description: "",
          type: GraphQLInt,
        },
        before: {
          description: "",
          type: GraphQLString,
        },
      },
      resolve: (
        obj: Contact,
        args: any,
        context: RequestContext<ExampleViewerAlias>,
      ) => {
        return new GraphQLEdgeConnection(
          obj.viewer,
          obj,
          (v, obj: Contact) => ContactToCommentsQuery.query(v, obj),
          args,
        );
      },
    },
    likers: {
      type: new GraphQLNonNull(ContactToLikersConnectionType()),
      args: {
        first: {
          description: "",
          type: GraphQLInt,
        },
        after: {
          description: "",
          type: GraphQLString,
        },
        last: {
          description: "",
          type: GraphQLInt,
        },
        before: {
          description: "",
          type: GraphQLString,
        },
      },
      resolve: (
        obj: Contact,
        args: any,
        context: RequestContext<ExampleViewerAlias>,
      ) => {
        return new GraphQLEdgeConnection(
          obj.viewer,
          obj,
          (v, obj: Contact) => ContactToLikersQuery.query(v, obj),
          args,
        );
      },
    },
    attachedComments: {
      type: new GraphQLNonNull(ContactCommentsFromAttachmentConnectionType()),
      args: {
        first: {
          description: "",
          type: GraphQLInt,
        },
        after: {
          description: "",
          type: GraphQLString,
        },
        last: {
          description: "",
          type: GraphQLInt,
        },
        before: {
          description: "",
          type: GraphQLString,
        },
      },
      resolve: (
        obj: Contact,
        args: any,
        context: RequestContext<ExampleViewerAlias>,
      ) => {
        return new GraphQLEdgeConnection(
          obj.viewer,
          obj,
          (v, obj: Contact) => ContactCommentsFromAttachmentQuery.query(v, obj),
          args,
        );
      },
    },
    fullName: {
      type: new GraphQLNonNull(GraphQLString),
    },
    plusEmails: {
      type: new GraphQLNonNull(EmailInfoType),
      resolve: async (
        obj: Contact,
        args: {},
        context: RequestContext<ExampleViewerAlias>,
      ) => {
        return obj.queryPlusEmails();
      },
    },
    contactItems: {
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(ContactItemResultType)),
      ),
      args: {
        filter: {
          description: "",
          type: ContactItemFilterType,
        },
      },
      resolve: async (
        obj: Contact,
        args: any,
        context: RequestContext<ExampleViewerAlias>,
      ) => {
        return obj.queryContactItems(args.filter);
      },
    },
  }),
  interfaces: () => [GraphQLNodeInterface],
  isTypeOf(obj) {
    return obj instanceof Contact;
  },
});

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
