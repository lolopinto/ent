/**
 * Copyright whaa whaa
 */

import { AllowIfEntIsVisiblePolicy, PrivacyPolicy } from "@snowtop/ent";
import { Contact } from "./index.js";
import { ContactPhoneNumberBase } from "./internal.js";

export class ContactPhoneNumber extends ContactPhoneNumberBase {
  getPrivacyPolicy(): PrivacyPolicy<this> {
    return new AllowIfEntIsVisiblePolicy(
      this.contactId,
      Contact.loaderOptions(),
    );
  }
}
