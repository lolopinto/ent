import { AllowIfEntIsVisibleRule } from "@lolopinto/ent";
import {
  CreateAddressActionBase,
  AddressCreateInput,
} from "src/ent/address/actions/generated/create_address_action_base";
import { AllowIfBuilder } from "@lolopinto/ent/action";
import { getLoaderOptions } from "src/ent/loadAny";
import { NodeType } from "src/ent/const";

export { AddressCreateInput };

// we're only writing this once except with --force and packageName provided
export default class CreateAddressAction extends CreateAddressActionBase {
  getPrivacyPolicy() {
    return {
      rules: [
        new AllowIfBuilder(this.input.ownerID),
        // new AllowIfEntIsVisibleRule(
        //   this.input.ownerID,
        //   getLoaderOptions((this.input.ownerType as unknown) as NodeType),
        // ),
      ],
    };
  }
}
