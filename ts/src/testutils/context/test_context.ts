import { Context, Viewer } from "../../core/base";
import { ContextCache } from "../../core/context";
import { LoggedOutViewer } from "../../core/viewer";

export class TestContext implements Context {
  cache: ContextCache = new ContextCache();
  viewer = new LoggedOutViewer(this);

  getViewer(): Viewer {
    return this.viewer;
  }
}
