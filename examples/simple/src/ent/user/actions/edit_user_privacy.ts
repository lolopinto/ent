import {
  PrivacyPolicy,
  AllowIfViewerRule,
  AlwaysDenyRule,
} from "@snowtop/snowtop-ts";

export const EditUserPrivacy: PrivacyPolicy = {
  rules: [AllowIfViewerRule, AlwaysDenyRule],
};
