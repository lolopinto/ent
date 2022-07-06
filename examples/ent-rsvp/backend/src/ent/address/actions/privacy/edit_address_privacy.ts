import { AllowIfEventCreatorFromActivityRule } from "src/ent/event/privacy/event_creator";
import {
  PrivacyPolicy,
  AlwaysDenyRule,
  PrivacyPolicyRule,
  AllowIfSubPolicyAllowsRule,
} from "@snowtop/ent";
import { AddressBuilder } from "../../../generated/address/actions/address_builder";
import { Address } from "src/ent";

export class EditAddressPrivacy implements PrivacyPolicy<Address> {
  constructor(private builder: AddressBuilder) {}

  rules: PrivacyPolicyRule<Address>[] = [
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
