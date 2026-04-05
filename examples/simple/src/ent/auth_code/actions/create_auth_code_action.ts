import { CreateAuthCodeActionBase } from "../../generated/auth_code/actions/create_auth_code_action_base";
import type {
  AuthCodeCreateInput,
  CreateAuthCodeActionTriggers,
  CreateAuthCodeActionObservers,
} from "../../generated/auth_code/actions/create_auth_code_action_base";
import { AuthCodeBuilder } from "../../generated/auth_code/actions/auth_code_builder";

import { ExampleViewer } from "../../../viewer/viewer";
import { AuthCode, UserStatistics } from "../../";
import type { Validator } from "@snowtop/ent/action";
import { query } from "@snowtop/ent";
import type { Data, UpdateOperation } from "@snowtop/ent";
import type { TransformedUpdateOperation } from "@snowtop/ent";
import { SQLStatementOperation } from "@snowtop/ent";
import { FakeComms, Mode } from "@snowtop/ent/testutils/fake_comms";
import EditUserStatisticsAction from "src/ent/user_statistics/actions/edit_user_statistics_action";
export type { AuthCodeCreateInput };
// we're only writing this once except with --force and packageName provided
export default class CreateAuthCodeAction extends CreateAuthCodeActionBase {
  getValidators(): Validator<
    AuthCode,
    AuthCodeBuilder<AuthCodeCreateInput, AuthCode | null>,
    ExampleViewer,
    AuthCodeCreateInput,
    AuthCode | null
  >[] {
    return [
      {
        validate(builder: AuthCodeBuilder, input: AuthCodeCreateInput) {
          if (
            !(
              (input.emailAddress || input.phoneNumber) &&
              !(input.emailAddress && input.phoneNumber)
            )
          ) {
            throw new Error(
              `exactly one of phoneNumber and emailAddress needs to be provided`,
            );
          }
        },
      },
    ];
  }

  // transform create -> edit if user already has an auth code
  async transformWrite(
    stmt: UpdateOperation<AuthCode, ExampleViewer>,
  ): Promise<TransformedUpdateOperation<AuthCode, ExampleViewer> | null> {
    const input = this.input;

    const existing = await AuthCode.loadCustom(
      stmt.builder.viewer,
      query.And(
        query.And(
          query.Eq("user_id", input.userId),
          query.Eq("email_address", input.emailAddress),
        ),
      ),
    );

    if (!existing.length) {
      return null;
    }

    if (existing.length > 1) {
      throw new Error("multiple auth codes found");
    }

    const first = existing[0];

    const data: Data = {};
    for (const k in input) {
      // @ts-ignore
      data[k] = first[k];

      // take existing data from ent, use the new code
      if (k === "code") {
        data[k] = input[k];
      }
    }

    return {
      op: SQLStatementOperation.Update,
      existingEnt: first,
      data,
    };
  }

  getTriggers(): CreateAuthCodeActionTriggers {
    return [
      {
        async changeset(builder, input) {
          const stats = await UserStatistics.loadFromUserIdX(
            builder.viewer,
            input.userId,
          );
          return EditUserStatisticsAction.create(builder.viewer, stats, {
            authCodeEmailsSent: {
              add: 1,
            },
          }).changeset();
        },
      },
    ];
  }

  getObservers(): CreateAuthCodeActionObservers {
    return [
      {
        observe(builder, input) {
          if (input.emailAddress) {
            // send email
            FakeComms.send({
              to: input.emailAddress,
              mode: Mode.EMAIL,
              from: input.from ?? "noreply@foo.com",
              subject: input.subject ?? "auth code",
              body: input.body ?? `your auth code is ${input.code}`,
            });
          }
          if (input.phoneNumber) {
            // send sms
            FakeComms.send({
              to: input.phoneNumber,
              mode: Mode.SMS,
              from: input.from ?? "42423",
              body: input.body ?? `your auth code is ${input.code}`,
            });
          }
        },
      },
    ];
  }
}
