import { Field, FieldMap, Pattern } from "./schema";
import { v4 as uuidv4 } from "uuid";
import { TimestampType, UUIDType } from "./field";

let tsFields: FieldMap = {
  createdAt: TimestampType({
    hideFromGraphQL: true,
    disableUserEditable: true,
    defaultValueOnCreate: () => {
      return new Date();
    },
  }),
  updatedAt: TimestampType({
    hideFromGraphQL: true,
    disableUserEditable: true,
    defaultValueOnCreate: () => {
      return new Date();
    },
    defaultValueOnEdit: () => {
      return new Date();
    },
  }),
};

// Timestamps is a Pattern that adds a createdAt and updatedAt timestamp fields to the ent
export const Timestamps: Pattern = {
  name: "timestamps",
  fields: tsFields,
};

let nodeField = UUIDType({
  primaryKey: true,
  disableUserEditable: true,
  defaultValueOnCreate: () => {
    return uuidv4();
  },
});

let nodeFields: FieldMap = {
  // inconsistent naming :(
  ID: nodeField,
  ...tsFields,
};

let nodeFieldsWithTZ: FieldMap = {
  // inconsistent naming :(
  ID: nodeField,
  createdAt: TimestampType({
    hideFromGraphQL: true,
    disableUserEditable: true,
    defaultValueOnCreate: () => {
      return new Date();
    },
    withTimezone: true,
  }),
  updatedAt: TimestampType({
    hideFromGraphQL: true,
    disableUserEditable: true,
    defaultValueOnCreate: () => {
      return new Date();
    },
    defaultValueOnEdit: () => {
      return new Date();
    },
    withTimezone: true,
  }),
};

// Node is a Pattern that adds 3 fields to the ent: (id, createdAt, and updatedAt timestamps)
export const Node: Pattern = {
  name: "node",
  fields: nodeFields,
};

// Base ent schema. has Node Pattern by default.
// exists just to have less typing and easier for clients to implement
export abstract class BaseEntSchema {
  addPatterns(...patterns: Pattern[]) {
    this.patterns.push(...patterns);
  }

  patterns: Pattern[] = [Node];
}

export abstract class BaseEntSchemaWithTZ {
  addPatterns(...patterns: Pattern[]) {
    this.patterns.push(...patterns);
  }

  patterns: Pattern[] = [
    {
      // default schema added
      name: "nodeWithTZ",
      fields: nodeFieldsWithTZ,
    },
  ];
}
