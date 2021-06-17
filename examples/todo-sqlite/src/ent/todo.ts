import { AlwaysAllowPrivacyPolicy } from "@lolopinto/ent";
import { TodoBase } from "src/ent/internal";

export class Todo extends TodoBase {
  privacyPolicy = AlwaysAllowPrivacyPolicy;
}
