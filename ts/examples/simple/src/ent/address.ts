import { AddressBase } from "./generated/address_base";
import { AddressLoader } from "./generated/loaders";

// we're only writing this once except with --force and packageName provided
export default class Address extends AddressBase {}

AddressLoader.registerClass(Address);
