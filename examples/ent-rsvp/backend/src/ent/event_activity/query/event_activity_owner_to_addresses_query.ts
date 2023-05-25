import { Viewer } from "@snowtop/ent";
import { EventActivityBase, OwnerToAddressesQuery } from "src/ent/internal";

export class EventActivityOwnerToAddressesQuery extends OwnerToAddressesQuery {
  constructor(viewer: Viewer, srcEnt: EventActivityBase, sortColumn?: string) {
    super(viewer, srcEnt, sortColumn);
  }
}
