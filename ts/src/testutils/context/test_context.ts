import { Context, ContextCache } from "../../core/context";
import { Viewer } from "../../core/ent";
import { LoggedOutViewer } from "../../core/viewer";

export class TestContext implements Context {
  cache: ContextCache = new ContextCache();
  viewer = new LoggedOutViewer(this);

  getViewer(): Viewer {
    return this.viewer;
  }
}
