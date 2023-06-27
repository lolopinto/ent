/**
 * Copyright whaa whaa
 */

import { ExampleViewer } from "src/viewer/viewer";
import { User, UserToContactsQueryBase } from "../../internal";
import { ID } from "@snowtop/ent";

export class UserToContactsQuery extends UserToContactsQueryBase {
  constructor(viewer: ExampleViewer, user: User | ID) {
    super(viewer, user, "created_at");
  }
}
