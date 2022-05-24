/**
 * Copyright whaa whaa
 */

import { AllowIfEntIsVisiblePolicy, PrivacyPolicy } from "@snowtop/ent";
import { Contact } from ".";
import { ContactEmailBase } from "./internal";

export class ContactEmail extends ContactEmailBase {
  getPrivacyPolicy(): PrivacyPolicy<this> {
    return new AllowIfEntIsVisiblePolicy(
      this.contactID,
      Contact.loaderOptions(),
    );
  }
}
