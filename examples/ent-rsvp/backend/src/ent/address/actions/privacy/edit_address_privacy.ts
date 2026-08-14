import { AllowIfEventCreatorFromActivityRule } from "../../../event/privacy/event_creator.js";
import {
  PrivacyPolicy,
  AlwaysDenyRule,
  PrivacyPolicyRule,
  AllowIfSubPolicyAllowsRule,
} from "@snowtop/ent";
import { AddressBuilder } from "../../../generated/address/actions/address_builder.js";
import { Address } from "../../../index.js";

export class EditAddressPrivacy implements PrivacyPolicy<Address> {
  constructor(private builder: AddressBuilder) {}

  rules: PrivacyPolicyRule<Address>[] = [
    new AllowIfSubPolicyAllowsRule({
      rules: [
        new AllowIfEventCreatorFromActivityRule(
          this.builder.existingEnt!.ownerId,
        ),
        AlwaysDenyRule,
      ],
    }),
    AlwaysDenyRule,
  ];
}
