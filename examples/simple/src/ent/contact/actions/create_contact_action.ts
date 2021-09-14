import {
  CreateContactActionBase,
  ContactCreateInput,
} from "./generated/create_contact_action_base";

export { ContactCreateInput };
import { Contact } from "../../";
// TODO...
import { EntCreationObserver } from "@snowtop/ent/testutils/fake_log";
import {
  AllowIfViewerEqualsRule,
  AllowIfViewerRule,
  AlwaysDenyRule,
  PrivacyPolicy,
  Data,
  IDViewer,
} from "@snowtop/ent";
import { AllowIfBuilder } from "@snowtop/ent/action";

// we're only writing this once except with --force and packageName provided
export default class CreateContactAction extends CreateContactActionBase {
  observers = [new EntCreationObserver<Contact>()];

  getPrivacyPolicy(): PrivacyPolicy {
    return {
      rules: [
        AllowIfViewerRule,
        new AllowIfViewerEqualsRule(this.input.userID),
        new AllowIfBuilder(this.input.userID),
        AlwaysDenyRule,
      ],
    };
  }

  viewerForEntLoad(data: Data) {
    // needed if created in user action and we want to make sure this
    // ent is viewable. especially bcos of EntCreationObserver
    return new IDViewer(data.user_id);
  }
}
