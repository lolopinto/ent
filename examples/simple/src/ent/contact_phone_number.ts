/**
 * Copyright whaa whaa
 */

import { AllowIfEntIsVisiblePolicy, PrivacyPolicy } from "@snowtop/ent";
import { Contact } from ".";
import { ContactPhoneNumberBase } from "./internal";

export class ContactPhoneNumber extends ContactPhoneNumberBase {
  getPrivacyPolicy(): PrivacyPolicy<this> {
    return new AllowIfEntIsVisiblePolicy(
      this.contactID,
      Contact.loaderOptions(),
    );
  }
}
