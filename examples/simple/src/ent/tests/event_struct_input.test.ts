import { v4 as uuidv4 } from "uuid";
import { LoggedOutExampleViewer } from "../../viewer/viewer";
import { randomEmail, randomPhoneNumber } from "../../util/random";
import CreateUserAction from "../user/actions/create_user_action";
import CreateEventAction from "../event/actions/create_event_action";

const loggedOutViewer = new LoggedOutExampleViewer();

async function createUser() {
  return CreateUserAction.create(loggedOutViewer, {
    firstName: "Jon",
    lastName: "Snow",
    emailAddress: randomEmail(),
    phoneNumber: randomPhoneNumber(),
    password: "pa$$w0rd",
  }).saveX();
}

test("builder.getInput keeps struct list camelCase with transform pattern", async () => {
  const creator = await createUser();
  const creatorId = creator.id;
  const attachments = [
    {
      fileId: uuidv4(),
      dupeFileId: uuidv4(),
      note: "test note",
      date: new Date(),
      emailAddress: "test@example.com",
      creatorId: creatorId,
      creatorType: "user",
    },
  ];

  class CreateEventActionWithInputCheck extends CreateEventAction {
    getValidators() {
      return [
        ...super.getValidators(),
        {
          validate(builder: any) {
            const input = builder.getInput();
            const list = input.attachments;
            if (!Array.isArray(list) || list.length !== 1) {
              return new Error("expected attachments list in builder input");
            }
            const attachment = list[0] as any;
            if (
              attachment.fileId !== attachments[0].fileId ||
              attachment.dupeFileId !== attachments[0].dupeFileId ||
              attachment.note !== attachments[0].note ||
              attachment.emailAddress !== attachments[0].emailAddress ||
              attachment.creatorId !== attachments[0].creatorId
            ) {
              return new Error(
                "expected camelCase attachment fields in builder input",
              );
            }
            if (attachment.creatorType === undefined) {
              return new Error(
                "expected creatorType to be present in builder input",
              );
            }
            if (
              attachment.file_id !== undefined ||
              attachment.dupe_file_id !== undefined ||
              attachment.email_address !== undefined ||
              attachment.creator_id !== undefined
            ) {
              return new Error(
                "unexpected snake_case attachment fields in builder input",
              );
            }
          },
        },
      ];
    }
  }

  const action = CreateEventActionWithInputCheck.create(loggedOutViewer, {
    name: "event with attachments",
    creatorId: creatorId,
    startTime: new Date(),
    location: "location",
    attachments,
  });

  await action.validX();
});
