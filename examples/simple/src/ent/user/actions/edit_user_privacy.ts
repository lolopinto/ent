import { AllowIfViewerRule, AlwaysDenyRule } from "@snowtop/ent";
import type { PrivacyPolicy } from "@snowtop/ent";

export const EditUserPrivacy: PrivacyPolicy = {
  rules: [AllowIfViewerRule, AlwaysDenyRule],
};
