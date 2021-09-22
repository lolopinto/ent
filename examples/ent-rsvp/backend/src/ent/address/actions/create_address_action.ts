import { ID, Ent, AllowIfEntIsVisibleRule } from "@snowtop/ent";
import {
  AllowIfConditionAppliesRule,
  AlwaysDenyRule,
} from "@snowtop/ent/core/privacy";
import {
  CreateAddressActionBase,
  AddressCreateInput,
} from "src/ent/address/actions/generated/create_address_action_base";
import { AllowIfBuilder, Builder } from "@snowtop/ent/action";
import { getLoaderOptions } from "src/ent/generated/loadAny";
import { NodeType } from "src/ent/generated/const";

export { AddressCreateInput };

// we're only writing this once except with --force and packageName provided
export default class CreateAddressAction extends CreateAddressActionBase {
  getPrivacyPolicy() {
    return {
      rules: [
        new AllowIfBuilder(this.input.ownerID),
        // TODO this is too complicated.
        // change AllowIfEntIsVisibleRule to take Builder and discard it
        // need a better conditional check?
        // and/or a sub rule that somehow enforces types in some kind of chaining
        new AllowIfConditionAppliesRule(() => {
          return (
            (this.input.ownerID as Builder<Ent>).placeholderID === undefined
          );
        }, new AllowIfEntIsVisibleRule(this.input.ownerID as ID, getLoaderOptions(this.input.ownerType as unknown as NodeType))),
        AlwaysDenyRule,
      ],
    };
  }
}
