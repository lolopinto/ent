/**
 * Copyright whaa whaa
 */

import { ExampleViewer } from "../../../viewer/viewer.js";
import { User, UserToContactsQueryBase } from "../../internal.js";
import { ID } from "@snowtop/ent";

export class UserToContactsQuery extends UserToContactsQueryBase {
  constructor(viewer: ExampleViewer, user: User | ID) {
    super(viewer, user, "created_at");
  }
}
