import { Viewer } from "./ent";

export class LoggedOutViewer implements Viewer {
  viewerID: null;
  async viewer() {
    return null;
  }
  instanceKey(): string {
    return "viewer.LoggedOutViewer";
  }
}
