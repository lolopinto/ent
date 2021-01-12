import {
  EditAddressActionBase,
  AddressEditInput,
} from "src/ent/address/actions/generated/edit_address_action_base";

export { AddressEditInput };

// we're only writing this once except with --force and packageName provided
export default class EditAddressAction extends EditAddressActionBase {}
