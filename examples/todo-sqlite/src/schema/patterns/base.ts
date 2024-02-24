import { EntSchema, SchemaConfig, UUIDType, TimestampType } from "@snowtop/ent";
import { DeletedAtPattern } from "@snowtop/ent-soft-delete";
import { v4 as uuidv4 } from "uuid";

const fields = {
  id: UUIDType({
    primaryKey: true,
    defaultValueOnCreate: () => {
      return uuidv4();
    },
    disableUserGraphQLEditable: true,
  }),
  createdAt: TimestampType({
    hideFromGraphQL: true,
    defaultValueOnCreate: () => {
      return new Date();
    },
    disableUserGraphQLEditable: true,
  }),
  updatedAt: TimestampType({
    hideFromGraphQL: true,
    disableUserGraphQLEditable: true,
    defaultValueOnCreate: () => {
      return new Date();
    },
    onlyUpdateIfOtherFieldsBeingSet_BETA: true,
    defaultValueOnEdit: () => {
      return new Date();
    },
  }),
};

export class TodoBaseEntSchema extends EntSchema {
  constructor(cfg: SchemaConfig) {
    super(cfg);
    this.patterns = [
      // override default fields so we can test disableUsableGraphQLEditable
      {
        name: "todo_base",
        fields,
        disableMixin: true,
      },
      new DeletedAtPattern(),
      ...(cfg.patterns ?? []),
    ];
  }
}
