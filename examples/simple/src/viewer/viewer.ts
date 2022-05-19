import { Context, ID } from "@snowtop/ent";
import { Viewer } from "@snowtop/ent";
import { User } from "src/ent";

export interface ExampleViewerInt extends Viewer<ID | null, User | null> {
  isOmniscient(): boolean;
  isLoggedOut(): boolean;
  setContext(ctx: Context<ID | null, User | null>): any;
}

export class ExampleViewer implements ExampleViewerInt {
  public context?: Context<ID | null, User | null> | undefined;

  constructor(public viewerID: string | null) {}

  isOmniscient(): boolean {
    return false;
  }

  isLoggedOut(): boolean {
    return this.viewerID !== null;
  }

  setContext(ctx: Context<ID | null, User | null>) {
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
