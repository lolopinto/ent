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
import { NodeType } from "./types";
import {
  Address,
  AuthCode,
  Comment,
  Contact,
  ContactEmail,
  ContactPhoneNumber,
  Event,
  File,
  Holiday,
  HoursOfOperation,
  User,
  UserStatistics,
} from "../internal";

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

export function getLoaderOptions(type: NodeType): LoadEntOptions<Ent, any> {
  switch (type) {
    case NodeType.Address:
      return Address.loaderOptions();
    case NodeType.AuthCode:
      return AuthCode.loaderOptions();
    case NodeType.Comment:
      return Comment.loaderOptions();
    case NodeType.Contact:
      return Contact.loaderOptions();
    case NodeType.ContactEmail:
      return ContactEmail.loaderOptions();
    case NodeType.ContactPhoneNumber:
      return ContactPhoneNumber.loaderOptions();
    case NodeType.Event:
      return Event.loaderOptions();
    case NodeType.File:
      return File.loaderOptions();
    case NodeType.Holiday:
      return Holiday.loaderOptions();
    case NodeType.HoursOfOperation:
      return HoursOfOperation.loaderOptions();
    case NodeType.User:
      return User.loaderOptions();
    case NodeType.UserStatistics:
      return UserStatistics.loaderOptions();
    default:
      throw new Error(`invalid nodeType ${type} passed to getLoaderOptions`);
  }
}
