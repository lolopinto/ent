/**
 * Copyright whaa whaa
 */

import { AllowIfEntIsVisiblePolicy, PrivacyPolicy } from "@snowtop/ent";
import { Contact } from ".";
import { ContactEmailBase } from "./internal";

export class ContactEmail extends ContactEmailBase {
  privacyPolicy: PrivacyPolicy = new AllowIfEntIsVisiblePolicy(
    this.contactID,
    Contact.loaderOptions(),
  );
}
