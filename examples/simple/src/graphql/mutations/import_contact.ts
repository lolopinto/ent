import { ID, RequestContext } from "@snowtop/ent";
import {
  gqlContextType,
  gqlMutation,
  gqlFileUpload,
} from "@snowtop/ent/graphql";
import { GraphQLID } from "graphql";
import { FileUpload } from "graphql-upload";
import parse from "csv-parse";
import { User } from "../../ent";
import CreateContactAction from "../../ent/contact/actions/create_contact_action";
import { ExampleViewer } from "../../viewer/viewer";
import { ContactLabel } from "../../ent/generated/types";
import { ContactLabel2 } from "./custom_enum";
import { Transaction } from "@snowtop/ent/action";

export class ImportContactResolver {
  @gqlMutation({
    class: "ImportContactResolver",
    type: User,
    args: [
      gqlContextType(),
      {
        name: "userId",
        type: GraphQLID,
      },
      {
        name: "file",
        type: gqlFileUpload,
      },
      {
        name: "defaultLabel",
        type: "ContactLabel",
        nullable: true,
      },
      {
        name: "defaultLabel2",
        type: {
          type: "GraphQLContactLabel2",
          importPath: "src/graphql/mutations/custom_enum",
          tsType: "ContactLabel2",
          tsImportPath: "src/graphql/mutations/custom_enum",
        },
        nullable: true,
      },
    ],
    async: true,
  })
  async bulkUploadContact(
    context: RequestContext<ExampleViewer>,
    userId: ID,
    file: Promise<FileUpload>,
    label?: ContactLabel,
    _label2?: ContactLabel2,
  ) {
    const file2 = await file;

    const user = await User.loadX(context.getViewer(), userId);
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
              label: label ?? ContactLabel.Default,
            },
          ],
          userId: user.id,
        }),
      );
    }
    const tx = new Transaction(user.viewer, actions);
    await tx.run();

    return user;
  }
}
