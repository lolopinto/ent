import { Viewer } from "./ent";
import { Context } from "./auth/context";

export class LoggedOutViewer implements Viewer {
  constructor(public context?: Context) {}
  viewerID: null;
  async viewer() {
    return null;
  }
  instanceKey(): string {
    return "viewer.LoggedOutViewer";
  }
}
