import { AlwaysAllowPrivacyPolicy } from "@snowtop/ent";
import { AssignmentBase } from "./internal";

export class Assignment extends AssignmentBase {
  getPrivacyPolicy() {
    return AlwaysAllowPrivacyPolicy;
  }
}
