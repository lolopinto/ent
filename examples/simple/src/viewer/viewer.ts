import { Context, ID } from "@snowtop/ent";
import { Viewer } from "@snowtop/ent";
import { User } from "src/ent";

export interface ExampleViewerInt extends Viewer<User | null, ID | null> {
  isOmniscient(): boolean;
  isLoggedOut(): boolean;
  setContext(ctx: Context<ExampleViewer>): any;
}

export class ExampleViewer implements ExampleViewerInt {
  public context?: Context<this> | undefined;

  constructor(public viewerID: ID | null) {}

  isOmniscient(): boolean {
    return false;
  }

  isLoggedOut(): boolean {
    return this.viewerID !== null;
  }

  setContext(ctx: Context<this>) {
    this.context = ctx;
  }

  async viewer(): Promise<User | null> {
    if (this.viewerID === null) {
      return null;
    }
    return User.load(this, this.viewerID);
  }

  instanceKey(): string {
    return `exampleViewer: ${this.viewerID}`;
  }
}

export class LoggedOutExampleViewer extends ExampleViewer {
  constructor() {
    super(null);
  }
}
