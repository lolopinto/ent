import { ID, RequestContext } from "@snowtop/ent";
import {
  gqlContextType,
  gqlMutation,
  gqlFileUpload,
} from "@snowtop/ent/graphql";
import { GraphQLID } from "graphql";
import { FileUpload } from "graphql-upload";
import parse from "csv-parse";
import { BaseAction } from "@snowtop/ent/action/experimental_action";
import { User } from "../../ent";
import CreateContactAction from "../../ent/contact/actions/create_contact_action";
import {
  UserBuilder,
  UserInput,
} from "../../ent/generated/user/actions/user_builder";
import { ExampleViewer } from "../../viewer/viewer";
import { ContactEmailLabel } from "src/ent/generated/types";

export class ImportContactResolver {
  @gqlMutation({
    nodeName: "ImportContactResolver",
    type: User,
    args: [
      gqlContextType(),
      {
        name: "userID",
        type: GraphQLID,
      },
      {
        name: "file",
        type: gqlFileUpload,
      },
    ],
    async: true,
  })
  async bulkUploadContact(
    context: RequestContext<ExampleViewer>,
    userID: ID,
    file: Promise<FileUpload>,
  ) {
    const file2 = await file;

    const user = await User.loadX(context.getViewer(), userID);
    let actions: CreateContactAction[] = [];

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
          emails: [
            {
              emailAddress: record.emailAddress,
              label: ContactEmailLabel.Default,
            },
          ],
          userID: user.id,
        }),
      );
    }

    // not ideal we have to type this. should be able to get UserInput for free
    const action = BaseAction.bulkAction<User, ExampleViewer, UserInput>(
      user,
      UserBuilder,
      ...actions,
    );
    return await action.saveX();
  }
}
