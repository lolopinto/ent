// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import { NodeType } from "./const";
import {
  loadEnt,
  loadEntX,
  ID,
  Viewer,
  Ent,
  LoadEntOptions,
} from "@lolopinto/ent";
import {
  Address,
  AuthCode,
  Contact,
  Event,
  Holiday,
  HoursOfOperation,
  User,
} from "src/ent/internal";

export async function loadEntByType(
  viewer: Viewer,
  type: NodeType,
  id: ID,
): Promise<Ent | null> {
  return loadEnt(viewer, id, getLoaderOptions(type));
}

export async function loadEntXByType(
  viewer: Viewer,
  type: NodeType,
  id: ID,
): Promise<Ent> {
  return loadEntX(viewer, id, getLoaderOptions(type));
}

export function getLoaderOptions(type: NodeType): LoadEntOptions<Ent> {
  switch (type) {
    case NodeType.Address:
      return Address.loaderOptions();
    case NodeType.AuthCode:
      return AuthCode.loaderOptions();
    case NodeType.Contact:
      return Contact.loaderOptions();
    case NodeType.Event:
      return Event.loaderOptions();
    case NodeType.Holiday:
      return Holiday.loaderOptions();
    case NodeType.HoursOfOperation:
      return HoursOfOperation.loaderOptions();
    case NodeType.User:
      return User.loaderOptions();
  }
}
