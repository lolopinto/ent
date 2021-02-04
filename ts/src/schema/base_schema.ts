import { Field, DBType, Pattern } from "./schema";
import { v4 as uuidv4 } from "uuid";
import { TimeType } from "./field";

let tsFields: Field[];
tsFields = [
  TimeType({
    name: "createdAt",
    hideFromGraphQL: true,
    disableUserEditable: true,
    defaultValueOnCreate: () => {
      return new Date();
    },
    // TODO need a withTimezone time
  }),
  TimeType({
    name: "updatedAt",
    hideFromGraphQL: true,
    disableUserEditable: true,
    defaultValueOnCreate: () => {
      return new Date();
    },
    defaultValueOnEdit: () => {
      return new Date();
    },
  }),
];

// Timestamps is a Pattern that adds a createdAt and updatedAt timestamp fields to the ent
export const Timestamps = {
  fields: tsFields,
};

let nodeFields: Field[] = [
  {
    name: "ID",
    type: {
      dbType: DBType.UUID,
    },
    primaryKey: true,
    disableUserEditable: true,
    defaultValueOnCreate: () => {
      return uuidv4();
    },
  },
];
nodeFields = nodeFields.concat(tsFields);

// Node is a Pattern that adds 3 fields to the ent: (id, createdAt, and updatedAt timestamps)
export const Node = {
  fields: nodeFields,
};

// Base ent schema. has Node Pattern by default.
// exists just to have less typing and easier for clients to implement
export abstract class BaseEntSchema {
  patterns: Pattern[] = [Node];
}
