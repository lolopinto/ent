import { ID, RequestContext, Ent } from "@snowtop/ent";
import {
  gqlArg,
  gqlContextType,
  gqlMutation,
  gqlFileUpload,
} from "@snowtop/ent/graphql";
import { GraphQLID } from "graphql";
import { FileUpload } from "graphql-upload";
import parse from "csv-parse";
import { Action } from "@snowtop/ent/action";
import { BaseAction } from "@snowtop/ent/action/experimental_action";
import { User } from "../../ent";
import CreateContactAction from "../../ent/contact/actions/create_contact_action";
import { UserBuilder } from "../../ent/user/actions/generated/user_builder";

export class ImportContactResolver {
  @gqlMutation({ type: User })
  async bulkUploadContact(
    @gqlContextType() context: RequestContext,
    @gqlArg("userID", { type: GraphQLID }) userID: ID,
    @gqlArg("file", { type: gqlFileUpload }) file: Promise<FileUpload>,
  ) {
    const file2 = await file;

    const user = await User.loadX(context.getViewer(), userID);
    let actions: Action<Ent>[] = [];

    const parser = file2.createReadStream().pipe(
      parse({
        columns: ["firstName", "lastName", "emailAddress"],
        fromLine: 2, //skip header
        trim: true,
        skipEmptyLines: true,
        skipLinesWithEmptyValues: true,
      }),
    );
    for await (const record of parser) {
      actions.push(
        CreateContactAction.create(user.viewer, {
          firstName: record.firstName,
          lastName: record.lastName,
          emailAddress: record.emailAddress,
          userID: user.id,
        }),
      );
    }

    const action = BaseAction.bulkAction(user, UserBuilder, ...actions);
    return await action.saveX();
  }
}
