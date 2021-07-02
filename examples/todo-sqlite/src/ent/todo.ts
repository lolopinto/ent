import { AlwaysAllowPrivacyPolicy } from "@snowtop/snowtop-ts";
import { TodoBase } from "src/ent/internal";

export class Todo extends TodoBase {
  privacyPolicy = AlwaysAllowPrivacyPolicy;
}
