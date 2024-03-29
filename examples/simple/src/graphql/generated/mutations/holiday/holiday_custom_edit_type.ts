/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

import {
  GraphQLFieldConfig,
  GraphQLFieldConfigMap,
  GraphQLID,
  GraphQLInputFieldConfigMap,
  GraphQLInputObjectType,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLResolveInfo,
  GraphQLString,
} from "graphql";
import { RequestContext } from "@snowtop/ent";
import { GraphQLTime, mustDecodeIDFromGQLID } from "@snowtop/ent/graphql";
import { Holiday } from "../../../../ent";
import CustomEditHolidayAction, {
  CustomEditHolidayInput,
} from "../../../../ent/holiday/actions/custom_edit_holiday_action";
import {
  DayOfWeekAltType,
  DayOfWeekType,
  HolidayType,
} from "../../../resolvers";
import { ExampleViewer as ExampleViewerAlias } from "../../../../viewer/viewer";

interface customCustomEditHolidayInput extends CustomEditHolidayInput {
  id: string;
}

interface CustomEditHolidayPayload {
  holiday: Holiday | null;
}

export const CustomEditHolidayInputType = new GraphQLInputObjectType({
  name: "CustomEditHolidayInput",
  fields: (): GraphQLInputFieldConfigMap => ({
    id: {
      description: "id of Holiday",
      type: new GraphQLNonNull(GraphQLID),
    },
    dayOfWeek: {
      type: DayOfWeekType,
    },
    dayOfWeekAlt: {
      type: DayOfWeekAltType,
    },
    label: {
      type: GraphQLString,
    },
    date: {
      type: GraphQLTime,
    },
  }),
});

export const CustomEditHolidayPayloadType = new GraphQLObjectType({
  name: "CustomEditHolidayPayload",
  fields: (): GraphQLFieldConfigMap<
    CustomEditHolidayPayload,
    RequestContext<ExampleViewerAlias>
  > => ({
    holiday: {
      type: HolidayType,
    },
  }),
});

export const HolidayCustomEditType: GraphQLFieldConfig<
  undefined,
  RequestContext<ExampleViewerAlias>,
  { [input: string]: customCustomEditHolidayInput }
> = {
  type: new GraphQLNonNull(CustomEditHolidayPayloadType),
  args: {
    input: {
      description: "",
      type: new GraphQLNonNull(CustomEditHolidayInputType),
    },
  },
  resolve: async (
    _source,
    { input },
    context: RequestContext<ExampleViewerAlias>,
    _info: GraphQLResolveInfo,
  ): Promise<CustomEditHolidayPayload> => {
    const holiday = await CustomEditHolidayAction.saveFromID(
      context.getViewer(),
      mustDecodeIDFromGQLID(input.id),
      {
        dayOfWeek: input.dayOfWeek,
        dayOfWeekAlt: input.dayOfWeekAlt,
        label: input.label,
        date: input.date,
      },
    );
    return { holiday };
  },
};
