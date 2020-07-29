import {
  PrivacyPolicy,
  AllowIfViewerRule,
  AlwaysDenyRule,
} from "ent/core/privacy";

export const EditUserPrivacy: PrivacyPolicy = {
  rules: [AllowIfViewerRule, AlwaysDenyRule],
};
