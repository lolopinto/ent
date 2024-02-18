/**
 * Copyright whaa whaa
 */

import {
  AllowIfConditionAppliesRule,
  AllowIfEntIsVisibleRule,
  AllowIfViewerEqualsRule,
  AlwaysDenyRule,
  PrivacyPolicy,
} from "@snowtop/ent";
import { AllowIfBuilder } from "@snowtop/ent/action";
import { Contact } from "../..";
import {
  ContactPhoneNumberCreateInput,
  CreateContactPhoneNumberActionBase,
} from "../../generated/contact_phone_number/actions/create_contact_phone_number_action_base";

export { ContactPhoneNumberCreateInput };

export default class CreateContactPhoneNumberAction extends CreateContactPhoneNumberActionBase {
  getPrivacyPolicy(): PrivacyPolicy {
    return {
      rules: [
        // allow builder
        new AllowIfBuilder(this.input.contactId),
        // if viewer can see contact
        new AllowIfConditionAppliesRule(
          () => typeof this.input.contactId === "string",
          new AllowIfEntIsVisibleRule(
            this.input.contactId.toString(),
            Contact.loaderOptions(),
          ),
        ),
        new AllowIfViewerEqualsRule(this.input.contactId),
        AlwaysDenyRule,
      ],
    };
  }
}
