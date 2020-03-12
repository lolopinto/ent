import { Viewer } from "./ent";

export class LogedOutViewer implements Viewer {
  viewerID: null;
  async viewer() {
    return null;
  }
  instanceKey(): string {
    return "viewer.LoggedOutViewer";
  }
}
