import { AlwaysAllowPrivacyPolicy, Ent } from "@lolopinto/ent";
import { Trigger } from "@lolopinto/ent/action";
import {
  CreateTagActionBase,
  TagCreateInput,
} from "src/ent/tag/actions/generated/create_tag_action_base";
import { TagBuilder } from "./tag_builder";

export { TagCreateInput };

export default class CreateTagAction extends CreateTagActionBase {
  getPrivacyPolicy() {
    return AlwaysAllowPrivacyPolicy;
  }

  triggers: Trigger<Ent>[] = [
    {
      async changeset(builder: TagBuilder, input: TagCreateInput) {
        builder.updateInput({
          canonicalName: input.displayName,
        });
      },
    },
  ];
}
