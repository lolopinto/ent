// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  CustomEdgeQueryBase,
  Ent,
  ID,
  IndexLoaderFactory,
  RawCountLoaderFactory,
  Viewer,
} from "@snowtop/ent";
import { Address, addressLoader } from "src/ent/internal";

export const ownerToAddressesCountLoaderFactory = new RawCountLoaderFactory({
  ...Address.loaderOptions(),
  groupCol: "owner_id",
});
export const ownerToAddressesDataLoaderFactory = new IndexLoaderFactory(
  Address.loaderOptions(),
  "owner_id",
  {
    toPrime: [addressLoader],
  },
);

export class OwnerToAddressesQueryBase extends CustomEdgeQueryBase<
  Ent<Viewer>,
  Address,
  Viewer
> {
  constructor(viewer: Viewer, private srcEnt: Ent<Viewer>) {
    super(viewer, {
      src: srcEnt,
      countLoaderFactory: ownerToAddressesCountLoaderFactory,
      dataLoaderFactory: ownerToAddressesDataLoaderFactory,
      options: Address.loaderOptions(),
    });
  }

  static query<T extends OwnerToAddressesQueryBase>(
    this: new (viewer: Viewer, src: Ent<Viewer>) => T,
    viewer: Viewer,
    src: Ent<Viewer>,
  ): T {
    return new this(viewer, src);
  }

  async sourceEnt(_id: ID) {
    return this.srcEnt;
  }
}
