import { ID, Ent, Viewer, Context } from "./base";

export class LoggedOutViewer implements Viewer<never> {
  constructor(public context?: Context) {}
  viewerID = null;
  async viewer() {
    return null;
  }
  instanceKey(): string {
    return "viewer.LoggedOutViewer";
  }
}

export interface IDViewerOptions<T extends Ent = Ent> {
  viewerID: T["id"];
  context?: Context;
  ent?: T | null;
}

export class IDViewer<T extends Ent = Ent> implements Viewer<T> {
  public viewerID: T["id"];
  private ent: T | null = null;
  public context?: Context;

  constructor(viewerID: T["id"], opts?: Partial<IDViewerOptions<T>>);
  constructor(opts: IDViewerOptions<T>);
  constructor(args: IDViewerOptions<T> | T["id"], opts?: IDViewerOptions<T>) {
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
