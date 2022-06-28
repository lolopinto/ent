import { ID, RequestContext, Data, Ent } from "@snowtop/ent";
import {
  gqlArg,
  gqlContextType,
  gqlFileUpload,
  gqlMutation,
} from "@snowtop/ent/graphql";
import { Action } from "@snowtop/ent/action";
import { GraphQLID } from "graphql";
import { Event } from "src/ent";
import { FileUpload } from "graphql-upload";
import parse from "csv-parse";
import CreateGuestGroupAction from "src/ent/guest_group/actions/create_guest_group_action";
import CreateGuestAction from "src/ent/guest/actions/create_guest_action";
import { BaseAction } from "@snowtop/ent/action/experimental_action";
import { EventBuilder } from "src/ent/event/actions/generated/event_builder";

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
        trim: true,
        skipEmptyLines: true,
      }),
    );

    let requiredColumns = new Set(["invitationName", "name", "emailAddress"]);

    let actions: Action<Ent>[] = [];

    let parsedHeaders = false;
    let columns: string[] = [];
    let extraColumns: string[] = [];

    for await (const record of parser) {
      if (!parsedHeaders) {
        for (const val of record) {
          columns.push(val);
          if (!requiredColumns.has(val)) {
            extraColumns.push(val);
          }
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

      const r = /^additional\s?guest(\s?(\d+)?\s?(email.*)?)?$/i;
      let row: Data = {};
      let extraGuests: Data[] = [];
      for (let i = 0; i < record.length; i++) {
        let column = columns[i];
        let value = record[i];

        const match = r.exec(column);
        // expected. let's bounce
        if (!match) {
          row[column] = value;
          continue;
        }
        if (!value) {
          continue;
        }
        let guestCount = 0;
        if (match[2]) {
          guestCount = parseInt(match[2], 10);
        }
        let extraGuest = extraGuests[guestCount] || {};
        if (extraGuests[guestCount] == undefined) {
          extraGuests[guestCount] = {};
        }
        if (match[3]) {
          extraGuest.emailAddress = value;
        } else {
          extraGuest.name = value;
        }

        extraGuests[guestCount] = extraGuest;
      }

      // TODO this can be updated to check for duplicates but we don't care about that since not a real world program
      let groupAction = CreateGuestGroupAction.create(context.getViewer(), {
        invitationName: row.invitationName,
        eventID,
      });
      actions.push(groupAction);
      actions.push(
        CreateGuestAction.create(context.getViewer(), {
          eventID,
          guestGroupID: groupAction.builder,
          name: row.name,
          emailAddress: row.emailAddress,
        }),
      );

      extraGuests.forEach((guest) =>
        actions.push(
          CreateGuestAction.create(context.getViewer(), {
            eventID,
            guestGroupID: groupAction.builder,
            name: guest.name,
            emailAddress: guest.emailAddress,
          }),
        ),
      );
    }

    const action = BaseAction.bulkAction(event, EventBuilder, ...actions);
    return action.saveX();
  }
}
