import {
  CreateAuthCodeActionBase,
  AuthCodeCreateInput,
} from "../../generated/auth_code/actions/create_auth_code_action_base";
import { AuthCodeBuilder } from "../../generated/auth_code/actions/auth_code_builder";

export { AuthCodeCreateInput };
import { ExampleViewer } from "../../../viewer/viewer";
import { AuthCode } from "../../";
import { Validator } from "@snowtop/ent/action";
import { Data, UpdateOperation, query } from "@snowtop/ent";
import { TransformedUpdateOperation } from "@snowtop/ent";
import { SQLStatementOperation } from "@snowtop/ent";

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
}
