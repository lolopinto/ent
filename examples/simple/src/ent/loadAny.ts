/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

import {
  Ent,
  ID,
  LoadEntOptions,
  Viewer,
  loadEnt,
  loadEntX,
} from "@snowtop/ent";
import {
  Address,
  AuthCode,
  Comment,
  Contact,
  Event,
  Holiday,
  HoursOfOperation,
  User,
} from "./.";
import { NodeType } from "./const";

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
    case NodeType.Comment:
      return Comment.loaderOptions();
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
