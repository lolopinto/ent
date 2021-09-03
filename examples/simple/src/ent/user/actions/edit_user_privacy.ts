import { PrivacyPolicy, AllowIfViewerRule, AlwaysDenyRule } from "@snowtop/ent";

export const EditUserPrivacy: PrivacyPolicy = {
  rules: [AllowIfViewerRule, AlwaysDenyRule],
};
