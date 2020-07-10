import { ID, Ent, Viewer } from "ent/ent";
import { Context } from "ent/auth/context";

export class IDViewer implements Viewer {
  constructor(
    public viewerID: ID,
    public context?: Context,
    private ent: Ent | null = null,
  ) {}
  async viewer() {
    return this.ent;
  }
  instanceKey(): string {
    return `idViewer: ${this.viewerID}`;
  }
}
