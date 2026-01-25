import { AlwaysAllowPrivacyPolicy } from "@snowtop/ent";
import { CreateTagActionBase } from "src/ent/generated/tag/actions/create_tag_action_base";
import type { TagCreateInput, CreateTagActionTriggers } from "src/ent/generated/tag/actions/create_tag_action_base";

export type { TagCreateInput };

export class CreateTagAction extends CreateTagActionBase {
  getPrivacyPolicy() {
    return AlwaysAllowPrivacyPolicy;
  }

  getTriggers(): CreateTagActionTriggers {
    return [
      {
        async changeset(builder, input) {
          if (!input.canonicalName) {
            builder.updateInput({
              canonicalName: input.displayName,
            });
          }
        },
      },
    ];
  }
}
