import { AllowIfEventCreatorFromActivityRule } from "src/ent/event/privacy/event_creator";
import {
  PrivacyPolicy,
  AlwaysDenyRule,
  PrivacyPolicyRule,
  AllowIfSubPolicyAllowsRule,
} from "@snowtop/ent";
import { AddressBuilder } from "../generated/address_builder";

export class EditAddressPrivacy implements PrivacyPolicy {
  constructor(private builder: AddressBuilder) {}

  rules: PrivacyPolicyRule[] = [
    new AllowIfSubPolicyAllowsRule({
      rules: [
        new AllowIfEventCreatorFromActivityRule(
          this.builder.existingEnt!.ownerID,
        ),
        AlwaysDenyRule,
      ],
    }),
    AlwaysDenyRule,
  ];
}
