import { Viewer } from "@snowtop/ent";
import { OwnerToAddressesQuery, UserBase } from "../../internal.js";

export class UserOwnerToAddressesQuery extends OwnerToAddressesQuery {
  constructor(viewer: Viewer, srcEnt: UserBase, sortColumn?: string) {
    super(viewer, srcEnt, sortColumn);
  }
}
