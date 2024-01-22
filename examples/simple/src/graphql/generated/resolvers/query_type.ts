/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

import { GraphQLObjectType } from "graphql";
import {
  CanViewerDoQueryType,
  CommentConnectionQueryType,
  CommentListDeprecatedQueryType,
  ContactConnectionQueryType,
  ContactEmailConnectionQueryType,
  ContactEmailListDeprecatedQueryType,
  ContactListDeprecatedQueryType,
  ContactPhoneNumberConnectionQueryType,
  ContactPhoneNumberListDeprecatedQueryType,
  EventConnectionQueryType,
  EventListDeprecatedQueryType,
  FileConnectionQueryType,
  FileListDeprecatedQueryType,
  HolidayConnectionQueryType,
  HolidayListDeprecatedQueryType,
  HoursOfOperationConnectionQueryType,
  HoursOfOperationListDeprecatedQueryType,
  NodeQueryType,
  TimeDiffQueryType,
  UserConnectionQueryType,
  UserListDeprecatedQueryType,
  ViewerQueryType,
} from "../../resolvers/internal";

export const QueryType = new GraphQLObjectType({
  name: "Query",
  fields: () => ({
    can_viewer_do: CanViewerDoQueryType,
    comment_connection: CommentConnectionQueryType,
    comment_list_deprecated: CommentListDeprecatedQueryType,
    contact_connection: ContactConnectionQueryType,
    contact_email_connection: ContactEmailConnectionQueryType,
    contact_email_list_deprecated: ContactEmailListDeprecatedQueryType,
    contact_list_deprecated: ContactListDeprecatedQueryType,
    contact_phone_number_connection: ContactPhoneNumberConnectionQueryType,
    contact_phone_number_list_deprecated:
      ContactPhoneNumberListDeprecatedQueryType,
    event_connection: EventConnectionQueryType,
    event_list_deprecated: EventListDeprecatedQueryType,
    file_connection: FileConnectionQueryType,
    file_list_deprecated: FileListDeprecatedQueryType,
    holiday_connection: HolidayConnectionQueryType,
    holiday_list_deprecated: HolidayListDeprecatedQueryType,
    hours_of_operation_connection: HoursOfOperationConnectionQueryType,
    hours_of_operation_list_deprecated: HoursOfOperationListDeprecatedQueryType,
    node: NodeQueryType,
    timeDiff: TimeDiffQueryType,
    user_connection: UserConnectionQueryType,
    user_list_deprecated: UserListDeprecatedQueryType,
    viewer: ViewerQueryType,
  }),
});
