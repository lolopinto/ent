// Schema is the base for every schema in typescript
export default interface Schema {
  // schema has list of fields that are unique to each node
  fields: Field[]; 

  // optional, can be overriden as needed
  tableName?: string;

  // reusable functionality in each schema
  patterns?: Pattern[];

  // edges in the schema
  edges?: Edge[];
}

// An AssocEdge is an edge between 2 ids that has a common table/edge format 
// columns are
// id1 uuid (or int64), 
// id1Type type (enum), TODO
// edgeType (enum?), TODO
// id2 uuid (or int64)
// id2Type (enum), TODO
// time (time without time zone)
// data  (string)
// common edge type means we can support all types of common functionality
// across different edges
// we also get 3 types of assocs from the framework: 1-way (favorite), inverse (followers + followees), symmetric (friends)
// default is 1-way
export interface AssocEdge {
  // name of the edge e.g. creator, hosts, etc. edge name should be plural except for unique edges
  name: string; 
  // name of schema which edge is pointing to e.g. User, Address
  schemaName: string;
  // symmetric edge? should we write an edge from id2 -> id1 of the same edgeType?
  symmetric?: boolean;
  // unique edge. add constraint and enforce that not more than one can be written
  unique?: boolean;
  // inverse edge. should we write an inverse edge from id2 -> id1 of the inverse edge type
  inverseEdge?: InverseAssocEdge;
  // optional, can be overriden as needed. if not provided, schema generates one
  tableName?: string;
}

// Information about the inverse edge of an assoc edge
export interface InverseAssocEdge {
  // name of the inverse edge
  name: string;
}

// AssocEdgeGroup provides a way to group related edges together
// e.g. rsvps and you have an invited, attending, declined edge all together in the same 
// table and a way to configure it so that changing one edge also affects the others
export interface AssocEdgeGroup {
  name: string;
  groupStatusName: string;
  tableName?: string;
  assocEdges: AssocEdge[];
}

// edges we support from the schema
// there are some implied edges that are derived from fields: foreignKeys/fieldEdges
// writing to those fields automatically writes to the defined edges
// TODO other edges such as join tables 3-way id1->id2 (data)
export type Edge = AssocEdge | AssocEdgeGroup;

// Pattern is reusable functionality that leads to code sharing
// The most commonly used pattern in the ent framework is going to be the Node pattern
// which automatically provides 3 fields to every ent: id, created_at, updated_at
export interface Pattern {
  fields: Field[]; 
}

// we want --strictNullChecks flag so nullable is used to type graphql, ts, db
// should eventually generate (boolean | null) etc

// supported db types
export enum DBType {
  UUID = "UUID", 
  Int64ID = "Int64ID", // unsupported right now
  Boolean = "Boolean",
  Int = "Int",
  Float = "Float",
  String = "String",
  Time = "Time",
  JSON = "JSON", // tuple, lists, everything else converges on this
}

// represents the type of each field
export interface Type {
  dbType: DBType; // type in the db
  // TODO make these required eventually once we get there
  type?: string; // typescript type
  graphQLType?: string // graphql type
}

// FieldOptions are configurable options for fields.
// Can be combined with options for specific field types as neededs
export interface FieldOptions {
  name: string; 
  // optional modification of fields: nullable/storagekey etc.
  nullable?: boolean; 
  storageKey?: string; // db?
  serverDefault?: any;
  unique?: boolean;
  hideFromGraphQL?:boolean;
  private?:boolean;
  graphqlName?:string;
  index?:boolean;
  foreignKey?:[string,string];
  fieldEdge?:[string, string]; // replaces fieldEdge above...
  // TODO put this on id field not all field options?
  primaryKey?: boolean; // can only have one in a schema. Node provides id as default primary key in a schema
}

// Field interface that each Field needs to support
export interface Field extends FieldOptions {
  // type of field. db, typescript, graphql types encoded in here
  type: Type; 

  // optional valid and format to validate and format before storing
  valid?(val: any):boolean;
  format?(val: any):any;
}

let tsFields: Field[];
tsFields = [
  {
    name: "createdAt",
    type: {
      dbType: DBType.Time,
    },
    hideFromGraphQL: true,
//    serverDefault: 'now()', // not what we actually want because now() seems to be with timezone and default timestamp is without timezone
// so probably want to do this in typescript similar to what we do in golang
// TODO need a withTimezone time
  },
  {
    name: "updatedAt",
    type: {
      dbType: DBType.Time,
    },
    hideFromGraphQL: true,
//    serverDefault: 'now()', same as above. Also need a default update value but that's not serverDefault
  },
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
