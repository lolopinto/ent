/**
 * Copyright whaa whaa
 */

import { AllowIfEntIsVisiblePolicy, PrivacyPolicy } from "@snowtop/ent";
import { Contact } from ".";
import { ContactPhoneNumberBase } from "./internal";

export class ContactPhoneNumber extends ContactPhoneNumberBase {
  privacyPolicy: PrivacyPolicy = new AllowIfEntIsVisiblePolicy(
    this.contactID,
    Contact.loaderOptions(),
  );
}
