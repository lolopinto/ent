import { ID, Viewer, Ent } from "../ent";
import { Context } from "src/auth/context";

export class IDViewer implements Viewer {
  constructor(
    public viewerID: ID,
    private ent: Ent | null = null,
    public context?: Context,
  ) {}
  async viewer() {
    return this.ent;
  }
  instanceKey(): string {
    return `idViewer: ${this.viewerID}`;
  }
}
