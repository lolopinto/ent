import { AlwaysAllowPrivacyPolicy } from "@snowtop/ent";
import { TodoBase } from "src/ent/internal";

export class Todo extends TodoBase {
  privacyPolicy = AlwaysAllowPrivacyPolicy;
}
