/**
 * Copyright whaa whaa
 */

import { AllowIfEntIsVisiblePolicy, PrivacyPolicy } from "@snowtop/ent";
import { Contact } from "./index.js";
import { ContactEmailBase } from "./internal.js";

export class ContactEmail extends ContactEmailBase {
  getPrivacyPolicy(): PrivacyPolicy<this> {
    return new AllowIfEntIsVisiblePolicy(
      this.contactId,
      Contact.loaderOptions(),
    );
  }
}
