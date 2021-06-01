// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  GraphQLFieldConfigMap,
  GraphQLID,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
} from "graphql";
import { RequestContext } from "@lolopinto/ent";
import {
  GraphQLNodeInterface,
  convertToGQLEnum,
  nodeIDEncoder,
} from "@lolopinto/ent/graphql";
import { HoursOfOperation, getDayOfWeekValues } from "src/ent/";
import { dayOfWeekType } from "src/graphql/resolvers/internal";

export const HoursOfOperationType = new GraphQLObjectType({
  name: "HoursOfOperation",
  fields: (): GraphQLFieldConfigMap<HoursOfOperation, RequestContext> => ({
    id: {
      type: GraphQLNonNull(GraphQLID),
      resolve: nodeIDEncoder,
    },
    dayOfWeek: {
      type: GraphQLNonNull(dayOfWeekType),
      resolve: (
        hoursOfOperation: HoursOfOperation,
        args: {},
        context: RequestContext,
      ) => {
        const ret = hoursOfOperation.dayOfWeek;
        return convertToGQLEnum(
          ret,
          getDayOfWeekValues(),
          dayOfWeekType.getValues(),
        );
      },
    },
    open: {
      type: GraphQLNonNull(GraphQLString),
    },
    close: {
      type: GraphQLNonNull(GraphQLString),
    },
  }),
  interfaces: [GraphQLNodeInterface],
  isTypeOf(obj) {
    return obj instanceof HoursOfOperation;
  },
});
