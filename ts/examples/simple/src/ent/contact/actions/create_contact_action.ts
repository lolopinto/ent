import {
  CreateContactActionBase,
  ContactCreateInput,
} from "src/ent/contact/actions/generated/create_contact_action_base";

export { ContactCreateInput };
import { Contact } from "src/ent/";
// TODO...
import { EntCreationObserver } from "@lolopinto/ent/testutils/fake_log";
import {
  AllowIfViewerEqualsRule,
  AllowIfViewerRule,
  AlwaysDenyRule,
  PrivacyPolicy,
  ID,
} from "@lolopinto/ent";
import { AllowIfBuilder } from "@lolopinto/ent/action";

// we're only writing this once except with --force and packageName provided
export default class CreateContactAction extends CreateContactActionBase {
  observers = [new EntCreationObserver<Contact>()];

  getPrivacyPolicy(): PrivacyPolicy {
    return {
      rules: [
        AllowIfViewerRule,
        // TODO any
        new AllowIfViewerEqualsRule(this.input.userID as ID),
        new AllowIfBuilder(this.input.userID),
        AlwaysDenyRule,
      ],
    };
  }
}
