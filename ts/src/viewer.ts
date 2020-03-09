import { Viewer } from "./ent";

export class LogedOutViewer implements Viewer {
  viewer: null;
  viewerID: null;
  instanceKey(): string {
    return "viewer.LoggedOutViewer";
  }
}
