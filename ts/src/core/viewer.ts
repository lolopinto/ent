import { ID, Ent, Viewer, Context } from "./base";

export class LoggedOutViewer implements Viewer {
  constructor(public context?: Context) {}
  viewerID = null;
  async viewer() {
    return null;
  }
  instanceKey(): string {
    return "viewer.LoggedOutViewer";
  }
}

export interface IDViewerOptions {
  viewerID: ID;
  context?: Context;
  ent?: Ent | null;
}

export class IDViewer implements Viewer {
  public viewerID: ID;
  private ent: Ent | null = null;
  public context?: Context;

  constructor(viewerID: ID, opts?: Partial<IDViewerOptions>);
  constructor(opts: IDViewerOptions);
  constructor(args: IDViewerOptions | ID, opts?: IDViewerOptions) {
    if (typeof args === "object") {
      this.viewerID = args.viewerID;
      opts = args;
    } else {
      this.viewerID = args;
    }
    this.ent = opts?.ent || null;
    this.context = opts?.context;
  }

  async viewer() {
    return this.ent;
  }

  instanceKey(): string {
    return `idViewer: ${this.viewerID}`;
  }
}
