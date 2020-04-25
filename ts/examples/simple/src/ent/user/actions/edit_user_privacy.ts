import { PrivacyPolicy, AllowIfViewerRule, AlwaysDenyRule } from "ent/privacy";

export const EditUserPrivacy: PrivacyPolicy = {
  rules: [AllowIfViewerRule, AlwaysDenyRule],
};
