import { EntSchema, SchemaConfig } from "@snowtop/ent";
import { DeletedAtPattern } from "@snowtop/ent-soft-delete";

export class TodoBaseEntSchema extends EntSchema {
  constructor(cfg: SchemaConfig) {
    super({
      ...cfg,
      patterns: [new DeletedAtPattern(), ...(cfg.patterns ?? [])],
    });
  }
}
