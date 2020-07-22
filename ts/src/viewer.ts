import { Viewer } from "./ent";
import { ContextLite } from "./auth/context";

export class LoggedOutViewer implements Viewer {
  constructor(public context?: ContextLite) {}
  viewerID: null;
  async viewer() {
    return null;
  }
  instanceKey(): string {
    return "viewer.LoggedOutViewer";
  }
}
