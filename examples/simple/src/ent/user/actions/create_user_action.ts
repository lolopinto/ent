import {
  AlwaysAllowPrivacyPolicy,
  Data,
  PrivacyPolicy,
  Context,
} from "@snowtop/ent";
import { Changeset, Trigger, Observer } from "@snowtop/ent/action";
import { EntCreationObserver } from "@snowtop/ent/testutils/fake_log";
import { FakeComms, Mode } from "@snowtop/ent/testutils/fake_comms";
import {
  CreateUserActionBase,
  UserCreateInput,
} from "../../generated/user/actions/create_user_action_base";
import { UserBuilder } from "../../generated/user/actions/user_builder";
import CreateContactAction from "../../contact/actions/create_contact_action";
import { User } from "../../";

export { UserCreateInput };
import { ExampleViewer } from "../../../viewer/viewer";
import { ContactLabel } from "../../../ent/generated/types";

// we're only writing this once except with --force and packageName provided
export default class CreateUserAction extends CreateUserActionBase {
  getPrivacyPolicy(): PrivacyPolicy<User> {
    return AlwaysAllowPrivacyPolicy;
  }

  viewerForEntLoad(data: Data, ctx?: Context<ExampleViewer>) {
    const v = new ExampleViewer(data.id);
    if (ctx) {
      v.setContext(ctx);
    }
    return v;
  }

  getTriggers(): Trigger<
    User,
    UserBuilder<UserCreateInput, User | null>,
    ExampleViewer,
    UserCreateInput,
    User | null
  >[] {
    return [
      {
        // also create a contact for self when creating user
        changeset: (
          builder: UserBuilder,
          input: UserCreateInput,
        ): Promise<Changeset> => {
          // need a way to invalidate changesets
          // so if we are upserting and this changeset no longer makes sense,
          // we need to remove it...
          let action = CreateContactAction.create(this.builder.viewer, {
            firstName: input.firstName,
            lastName: input.lastName,
            emails: [
              {
                emailAddress: input.emailAddress,
                label: ContactLabel.Self,
              },
            ],
            userID: builder,
          });

          builder.addSelfContactID(action.builder, {
            conditional: true,
          });
          // TODO need an API for changesetWithOptions generated
          return action.builder.orchestrator.buildWithOptions_BETA({
            conditionalBuilder: builder,
          });
        },
      },
    ];
  }

  getObservers(): Observer<
    User,
    UserBuilder<UserCreateInput, User | null>,
    ExampleViewer,
    UserCreateInput,
    User | null
  >[] {
    return [
      {
        // same for observers...
        // e.g. when it's an upsert, don't send welcome email twice!
        observe: (_builder: UserBuilder, input: UserCreateInput): void => {
          let email = input.emailAddress;
          let firstName = input.firstName;
          FakeComms.send({
            from: "noreply@foo.com",
            to: email,
            subject: `Welcome, ${firstName}!`,
            body: `Hi ${firstName}, thanks for joining fun app!`,
            mode: Mode.EMAIL,
          });
        },
      },
      new EntCreationObserver(),
    ];
  }
}
