import {
  PrivacyPolicy,
  AlwaysDenyRule,
  PrivacyPolicyRule,
  AllowIfFuncRule,
  applyPrivacyPolicy,
} from "@snowtop/ent";
import { AddressBuilder } from "../../../generated/address/actions/address_builder";
import { Address } from "src/ent";
import { addressOwnerPrivacy } from "./address_owner_privacy";

export class EditAddressPrivacy implements PrivacyPolicy<Address> {
  constructor(private builder: AddressBuilder) {}
  rules: PrivacyPolicyRule<Address>[] = [
    new AllowIfFuncRule(async (viewer) => {
      const existing = this.builder.existingEnt!;
      return (
        (await applyPrivacyPolicy(
          viewer,
          addressOwnerPrivacy(viewer, existing.ownerId, existing.ownerType),
          existing,
        )) &&
        (await applyPrivacyPolicy(
          viewer,
          addressOwnerPrivacy(
            viewer,
            this.builder.getNewOwnerIdValue(),
            this.builder.getNewOwnerTypeValue(),
          ),
          existing,
        ))
      );
    }),
    AlwaysDenyRule,
  ];
}
