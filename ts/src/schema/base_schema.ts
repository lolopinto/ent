import { Field, FieldMap, Pattern } from "./schema";
import { v4 as uuidv4 } from "uuid";
import { TimestampType, UUIDType } from "./field";
import { Action, AssocEdgeGroup, Constraint, Edge, Index, Schema } from ".";

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
  disableMixin: true,
};

export interface SchemaConfig extends Schema {}

// Ent schema. has Node Pattern by default.
// exists just to have less typing and easier for clients to implement
export class EntSchema implements Schema {
  // Field[] compatibility reasons
  fields: FieldMap | Field[];

  tableName: string | undefined;

  patterns: Pattern[] = [Node];

  edges: Edge[] | undefined;

  edgeGroups: AssocEdgeGroup[] | undefined;

  actions: Action[] | undefined;

  enumTable: boolean | undefined;

  dbRows: { [key: string]: any }[] | undefined;

  constraints: Constraint[] | undefined;

  indices: Index[] | undefined;

  hideFromGraphQL?: boolean;

  constructor(cfg: SchemaConfig) {
    this.fields = cfg.fields;
    this.tableName = cfg.tableName;
    if (cfg.patterns) {
      this.patterns.push(...cfg.patterns);
    }
    this.edges = cfg.edges;
    this.edgeGroups = cfg.edgeGroups;
    this.actions = cfg.actions;
    this.enumTable = cfg.enumTable;
    this.dbRows = cfg.dbRows;
    this.constraints = cfg.constraints;
    this.indices = cfg.indices;
    this.hideFromGraphQL = cfg.hideFromGraphQL;
  }
}

export class EntSchemaWithTZ implements Schema {
  // Field[] compatibility reasons
  fields: FieldMap | Field[];

  tableName: string | undefined;

  patterns: Pattern[] = [
    {
      // default schema added
      name: "nodeWithTZ",
      fields: nodeFieldsWithTZ,
      disableMixin: true,
    },
  ];

  edges: Edge[] | undefined;

  edgeGroups: AssocEdgeGroup[] | undefined;

  actions: Action[] | undefined;

  enumTable: boolean | undefined;

  dbRows: { [key: string]: any }[] | undefined;

  constraints: Constraint[] | undefined;

  indices: Index[] | undefined;

  hideFromGraphQL?: boolean;

  constructor(cfg: SchemaConfig) {
    this.fields = cfg.fields;
    this.tableName = cfg.tableName;
    if (cfg.patterns) {
      this.patterns.push(...cfg.patterns);
    }
    this.edges = cfg.edges;
    this.edgeGroups = cfg.edgeGroups;
    this.actions = cfg.actions;
    this.enumTable = cfg.enumTable;
    this.dbRows = cfg.dbRows;
    this.constraints = cfg.constraints;
    this.indices = cfg.indices;
    this.hideFromGraphQL = cfg.hideFromGraphQL;
  }
}

// @deprecated use EntSchema
export abstract class BaseEntSchema {
  addPatterns(...patterns: Pattern[]) {
    this.patterns.push(...patterns);
  }

  patterns: Pattern[] = [Node];
}

// @deprecated use EntSchemaWithTZ
export abstract class BaseEntSchemaWithTZ {
  addPatterns(...patterns: Pattern[]) {
    this.patterns.push(...patterns);
  }

  patterns: Pattern[] = [
    {
      // default schema added
      name: "nodeWithTZ",
      fields: nodeFieldsWithTZ,
      disableMixin: true,
    },
  ];
}
