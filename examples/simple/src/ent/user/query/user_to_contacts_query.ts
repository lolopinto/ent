import { ID } from "@snowtop/ent";
import { ExampleViewer } from "src/viewer/viewer";
import { UserToContactsQueryBase, User } from "../../internal";

export class UserToContactsQuery extends UserToContactsQueryBase {
  constructor(viewer: ExampleViewer, src: User | ID) {
    super(viewer, src, "created_at");
  }
}
