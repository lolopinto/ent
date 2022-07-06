import { AlwaysAllowPrivacyPolicy, PrivacyPolicy } from "@snowtop/ent";
import { TodoBase } from "src/ent/internal";

export class Todo extends TodoBase {
  getPrivacyPolicy(): PrivacyPolicy<this> {
    return AlwaysAllowPrivacyPolicy;
  }

  getDeletedAt() {
    return this.deletedAt;
  }
}
