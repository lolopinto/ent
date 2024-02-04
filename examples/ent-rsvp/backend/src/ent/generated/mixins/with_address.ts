// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import { Data, Ent, ID, Viewer } from "@snowtop/ent";

type Constructor<T = {}> = new (...args: any[]) => T;

export function isWithAddress(ent: unknown): ent is IWithAddress {
  const o = ent as IWithAddress;
  return (o.isWithAddress && o.isWithAddress()) ?? false;
}

export interface IWithAddress extends Ent {
  isWithAddress(): boolean;
  addressId: ID | null;
}

function extractFromArgs<TViewer extends Viewer, TData extends Data>(
  args: any[],
): { viewer: TViewer; data: TData } {
  if (args.length !== 2) {
    throw new Error("args should be length 2");
  }
  return {
    viewer: args[0],
    data: args[1],
  };
}

export function WithAddressMixin<T extends Constructor>(BaseClass: T) {
  return class WithAddressMixin extends BaseClass {
    readonly addressId: ID | null;
    constructor(...args: any[]) {
      super(...args);
      const { data } = extractFromArgs(args);
      this.addressId = data.address_id;
    }

    isWithAddress() {
      return true;
    }
  };
}
