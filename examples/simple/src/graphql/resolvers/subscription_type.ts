import { RequestContext } from "@snowtop/ent";
import { GraphQLObjectType, GraphQLString } from "graphql";

export const SubscriptionType = new GraphQLObjectType({
  name: "Subscription",
  fields: () => ({
    greetings: {
      type: GraphQLString,
      // this just tests a subscription type is generated
      // doesn't actually do the bells and whistles of subscriptions
      subscribe: async function* (src, args, ctx: RequestContext) {
        for (const hi of ["Hi", "Bonjour", "Hola", "Ciao", "Zdravo"]) {
          yield { greetings: hi };
        }
      },
    },
  }),
});
