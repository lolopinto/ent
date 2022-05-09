import { Context, Viewer } from "../../core/base";
import { ContextCache } from "../../core/context";
import { LoggedOutViewer } from "../../core/viewer";

interface viewerWithContext extends Viewer {
  setContext(ctx: Context): any;
}

export class TestContext implements Context {
  constructor(viewer?: Viewer) {
    if (viewer) {
      this.viewer = viewer;
      if ((viewer as viewerWithContext).setContext !== undefined) {
        (viewer as viewerWithContext).setContext(this);
      }
    }
  }

  cache: ContextCache = new ContextCache();
  viewer: Viewer = new LoggedOutViewer(this);

  getViewer(): Viewer {
    return this.viewer;
  }
}
