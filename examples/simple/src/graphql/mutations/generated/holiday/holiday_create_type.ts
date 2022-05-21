/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

import {
  GraphQLFieldConfig,
  GraphQLFieldConfigMap,
  GraphQLInputFieldConfigMap,
  GraphQLInputObjectType,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLResolveInfo,
  GraphQLString,
} from "graphql";
import { RequestContext } from "@snowtop/ent";
import { GraphQLTime } from "@snowtop/ent/graphql";
import { Holiday } from "../../../../ent";
import CreateHolidayAction, {
  HolidayCreateInput,
} from "../../../../ent/holiday/actions/create_holiday_action";
import {
  DayOfWeekAltType,
  DayOfWeekType,
  HolidayType,
} from "../../../resolvers";

interface HolidayCreatePayload {
  holiday: Holiday;
}

export const HolidayCreateInputType = new GraphQLInputObjectType({
  name: "HolidayCreateInput",
  fields: (): GraphQLInputFieldConfigMap => ({
    dayOfWeek: {
      type: new GraphQLNonNull(DayOfWeekType),
    },
    dayOfWeekAlt: {
      type: DayOfWeekAltType,
    },
    label: {
      type: new GraphQLNonNull(GraphQLString),
    },
    date: {
      type: new GraphQLNonNull(GraphQLTime),
    },
  }),
});

export const HolidayCreatePayloadType = new GraphQLObjectType({
  name: "HolidayCreatePayload",
  fields: (): GraphQLFieldConfigMap<HolidayCreatePayload, RequestContext> => ({
    holiday: {
      type: new GraphQLNonNull(HolidayType),
    },
  }),
});

export const HolidayCreateType: GraphQLFieldConfig<
  undefined,
  RequestContext,
  { [input: string]: HolidayCreateInput }
> = {
  type: new GraphQLNonNull(HolidayCreatePayloadType),
  args: {
    input: {
      description: "",
      type: new GraphQLNonNull(HolidayCreateInputType),
    },
  },
  resolve: async (
    _source,
    { input },
    context: RequestContext,
    _info: GraphQLResolveInfo,
  ): Promise<HolidayCreatePayload> => {
    const holiday = await CreateHolidayAction.create(context.getViewer(), {
      dayOfWeek: input.dayOfWeek,
      dayOfWeekAlt: input.dayOfWeekAlt,
      label: input.label,
      date: input.date,
    }).saveX();
    return { holiday: holiday };
  },
};
