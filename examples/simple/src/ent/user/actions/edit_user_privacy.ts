import {
  PrivacyPolicy,
  AllowIfViewerRule,
  AlwaysDenyRule,
} from "@lolopinto/ent";

export const EditUserPrivacy: PrivacyPolicy = {
  rules: [AllowIfViewerRule, AlwaysDenyRule],
};
