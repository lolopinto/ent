import { Data, AssocEdge } from "@snowtop/ent";

export class CustomTodoEdge extends AssocEdge {
  deletedAt: Date | null = null;
  constructor(data: Data) {
    super(data);
    this.deletedAt = data.deleted_at;
  }
}
