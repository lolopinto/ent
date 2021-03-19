import { ID, RequestContext, Data, Ent } from "@lolopinto/ent";
import {
  gqlArg,
  gqlContextType,
  gqlFileUpload,
  gqlMutation,
} from "@lolopinto/ent/graphql";
import { Action } from "@lolopinto/ent/action";
import { GraphQLID } from "graphql";
import { Event } from "src/ent";
import { FileUpload } from "graphql-upload";
import parse from "csv-parse";
import CreateGuestGroupAction from "src/ent/guest_group/actions/create_guest_group_action";
import CreateGuestAction from "src/ent/guest/actions/create_guest_action";
import { BaseAction } from "@lolopinto/ent/action/experimental_action";
import { EventBuilder } from "src/ent/event/actions/event_builder";

export class ImportGuestResolver {
  @gqlMutation({ type: Event })
  async importGuests(
    @gqlContextType() context: RequestContext,
    @gqlArg("eventID", { type: GraphQLID }) eventID: ID,
    @gqlArg("file", { type: gqlFileUpload }) file: Promise<FileUpload>,
  ) {
    const file2 = await file;

    const event = await Event.loadX(context.getViewer(), eventID);

    const parser = file2.createReadStream().pipe(
      parse({
        //        columns: ["invitationName"],
        //        fromLine: 1, // skip header
        trim: true,
        skipEmptyLines: true,
      }),
    );

    let requiredColumns = new Set([
      "invitationName",
      "firstName",
      "lastName",
      "emailAddress",
    ]);

    let actions: Action<Ent>[] = [];

    let parsedHeaders = false;
    let columns: string[] = [];

    for await (const record of parser) {
      if (!parsedHeaders) {
        for (const val of record) {
          columns.push(val);
          requiredColumns.delete(val);
        }
        parsedHeaders = true;

        if (requiredColumns.size) {
          let missingCols: string[] = [];
          for (const col of requiredColumns) {
            missingCols.push(col);
          }
          throw new Error(
            `required columns ${missingCols.join(",")} not provided`,
          );
        }
        continue;
      }

      let row: Data = {};
      for (let i = 0; i < record.length; i++) {
        let column = columns[i];
        row[column] = record[i];
      }
      let groupAction = CreateGuestGroupAction.create(context.getViewer(), {
        invitationName: row.invitationName,
        eventID,
      });
      //      groupAction.changeset
      // this doesn't work when they are siblings in the graph...
      let guestAction = CreateGuestAction.create(context.getViewer(), {
        eventID,
        guestGroupID: groupAction.builder,
        firstName: row.firstName,
        lastName: row.lastName,
        emailAddress: row.emailAddress,
      });
      // TODO other guests....
      actions.push(groupAction, guestAction);
    }
    console.log(columns);
    const action = BaseAction.bulkAction(event, EventBuilder, ...actions);
    return action.saveX();
  }
}
