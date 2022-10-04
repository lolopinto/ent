/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

import { Data, Viewer } from "@snowtop/ent";
import { ContactInfo, convertContactInfo } from "../contact_info";

type Constructor<T = {}> = new (...args: any[]) => T;

export interface IContactInfo {
  isContactInfo(): boolean;
  extra: ContactInfo | null;
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

export function ContactInfoMixin<T extends Constructor>(BaseClass: T) {
  return class ContactInfoMixin extends BaseClass {
    readonly extra: ContactInfo | null;
    constructor(...args: any[]) {
      super(...args);
      const { data } = extractFromArgs(args);
      this.extra = convertContactInfo(data.extra);
    }

    isContactInfo() {
      return true;
    }
  };
}
