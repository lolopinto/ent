import { Viewer } from "@snowtop/ent";
import { OwnerToAddressesQuery, UserBase } from "src/ent/internal";

export class OwnersFromUserToAddressesQuery extends OwnerToAddressesQuery {
  constructor(viewer: Viewer, srcEnt: UserBase, sortColumn?: string) {
    super(viewer, srcEnt, sortColumn);
  }
}
