import {
  CreateContactActionBase,
  ContactCreateInput,
} from "src/ent/contact/actions/generated/create_contact_action_base";

export { ContactCreateInput };
import { Contact } from "src/ent/";
// TODO...
import { EntCreationObserver } from "@snowtop/snowtop-ts/testutils/fake_log";
import {
  AllowIfViewerEqualsRule,
  AllowIfViewerRule,
  AlwaysDenyRule,
  PrivacyPolicy,
  Data,
  IDViewer,
} from "@snowtop/snowtop-ts";
import { AllowIfBuilder } from "@snowtop/snowtop-ts/action";

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
