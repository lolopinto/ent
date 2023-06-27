// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  AssocEdgeCountLoaderFactory,
  AssocEdgeLoaderFactory,
  AssocEdgeQueryBase,
  CustomEdgeQueryBase,
  EdgeQuerySource,
  Ent,
  ID,
  OrderBy,
  Viewer,
} from "@snowtop/ent";
import { getLoaderOptions } from "src/ent/generated/loadAny";
import { EdgeType, NodeType } from "src/ent/generated/types";
import { Address, AddressToLocatedAtEdge } from "src/ent/internal";

export const addressToLocatedAtCountLoaderFactory =
  new AssocEdgeCountLoaderFactory(EdgeType.AddressToLocatedAt);
export const addressToLocatedAtDataLoaderFactory = new AssocEdgeLoaderFactory(
  EdgeType.AddressToLocatedAt,
  () => AddressToLocatedAtEdge,
);

export abstract class AddressToLocatedAtQueryBase extends AssocEdgeQueryBase<
  Address,
  Ent<Viewer>,
  AddressToLocatedAtEdge,
  Viewer
> {
  constructor(
    viewer: Viewer,
    src: EdgeQuerySource<Address, Ent<Viewer>, Viewer>,
  ) {
    super(
      viewer,
      src,
      addressToLocatedAtCountLoaderFactory,
      addressToLocatedAtDataLoaderFactory,
      (str) => getLoaderOptions(str as NodeType),
    );
  }

  static query<T extends AddressToLocatedAtQueryBase>(
    this: new (
      viewer: Viewer,
      src: EdgeQuerySource<Address, Ent<Viewer>>,
    ) => T,
    viewer: Viewer,
    src: EdgeQuerySource<Address, Ent<Viewer>>,
  ): T {
    return new this(viewer, src);
  }

  sourceEnt(id: ID) {
    return Address.load(this.viewer, id);
  }
}

export class OwnerToAddressesQueryBase<
  TEnt extends Ent<Viewer> = Ent<Viewer>,
> extends CustomEdgeQueryBase<TEnt, Address, Viewer> {
  constructor(
    viewer: Viewer,
    private srcEnt: TEnt,
    sortColumn?: string | OrderBy,
  ) {
    super(viewer, {
      src: srcEnt,
      groupCol: "owner_id",
      loadEntOptions: Address.loaderOptions(),
      name: "OwnerToAddressesQuery",
      sortColumn: typeof sortColumn === "string" ? sortColumn : undefined,
      orderby: typeof sortColumn === "string" ? undefined : sortColumn,
    });
  }

  static query<
    T extends OwnerToAddressesQueryBase,
    TEnt extends Ent<Viewer> = Ent<Viewer>,
  >(this: new (viewer: Viewer, src: TEnt) => T, viewer: Viewer, src: TEnt): T {
    return new this(viewer, src);
  }

  async sourceEnt(_id: ID) {
    return this.srcEnt;
  }
}
