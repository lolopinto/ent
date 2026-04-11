import type { Data } from "@snowtop/ent";
import {
  SQLStatementOperation,
  type TransformedUpdateOperation,
  type UpdateOperation,
} from "@snowtop/ent/schema";
import { User } from "..";
import { NotifType } from "../generated/types";
import CreateUserAction, {
  type UserCreateInput,
} from "../user/actions/create_user_action";
import type { UserBuilder } from "../generated/user/actions/user_builder";
import { LoggedOutExampleViewer } from "../../viewer/viewer";
import { random, randomEmail, randomPhoneNumber } from "../../util/random";

test.skip(
  "transformWrite keeps generated struct list input in trigger shape",
  async () => {
    const viewer = new LoggedOutExampleViewer();
    const existing = await CreateUserAction.create(viewer, {
      firstName: "Existing",
      lastName: "User",
      emailAddress: randomEmail(),
      phoneNumber: randomPhoneNumber(),
      password: random(),
    }).saveX();

    const prefsList = [
      {
        finishedNux: true,
        notifTypes: [NotifType.EMAIL],
      },
      {
        finishedNux: false,
        notifTypes: [NotifType.MOBILE],
      },
    ];

    let triggerInput: UserCreateInput | undefined;
    let builderInput: Data | undefined;
    let builderGetter: UserCreateInput["prefsList"] | undefined;

    class TransformingCreateUserAction extends CreateUserAction {
      getTriggers() {
        return [
          {
            changeset(
              builder: UserBuilder<UserCreateInput>,
              input: UserCreateInput,
            ) {
              triggerInput = input;
              builderInput = builder.getInput();
              builderGetter = builder.getNewPrefsListValue();
            },
          },
        ];
      }

      transformWrite = (
        stmt: UpdateOperation<User>,
      ): TransformedUpdateOperation<User> | undefined => {
        if (stmt.op !== SQLStatementOperation.Insert || !stmt.data) {
          return;
        }

        const emailAddress = stmt.data.get("EmailAddress");
        const transformedPrefsList = stmt.data.get("prefsList");

        if (
          emailAddress === existing.emailAddress &&
          transformedPrefsList !== undefined
        ) {
          return {
            op: SQLStatementOperation.Update,
            existingEnt: existing,
            data: {
              prefsList: transformedPrefsList,
            },
          };
        }
      };
    }

    const action = TransformingCreateUserAction.create(viewer, {
      firstName: "Replacement",
      lastName: "User",
      emailAddress: existing.emailAddress,
      phoneNumber: randomPhoneNumber(),
      password: random(),
      prefsList,
    });

    await action.validX();

    expect(triggerInput?.prefsList).toEqual(prefsList);
    expect(builderInput?.prefsList).toEqual(prefsList);
    expect(builderGetter).toEqual(prefsList);
    expect(builderInput?.prefsList?.[0]).not.toHaveProperty("finished_nux");
  },
);
