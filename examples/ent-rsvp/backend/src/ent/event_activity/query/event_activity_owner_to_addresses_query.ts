import { Viewer } from "@snowtop/ent";
import { EventActivityBase, OwnerToAddressesQuery } from "../../internal.js";

export class EventActivityOwnerToAddressesQuery extends OwnerToAddressesQuery {
  constructor(viewer: Viewer, srcEnt: EventActivityBase, sortColumn?: string) {
    super(viewer, srcEnt, sortColumn);
  }
}
