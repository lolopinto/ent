/**
 * Copyright whaa whaa
 */

import {
  AllowIfConditionAppliesRule,
  AllowIfEntIsVisibleRule,
  AlwaysDenyRule,
  PrivacyPolicy,
} from "@snowtop/ent";
import { AllowIfBuilder } from "@snowtop/ent/action";
import { Contact } from "../../../ent";
import {
  ContactEmailCreateInput,
  CreateContactEmailActionBase,
} from "../../generated/contact_email/actions/create_contact_email_action_base";

export { ContactEmailCreateInput };

export default class CreateContactEmailAction extends CreateContactEmailActionBase {
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
        AlwaysDenyRule,
      ],
    };
  }
}
