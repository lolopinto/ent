// Schema is the base for every schema in typescript
export default interface Schema {
  // schema has list of fields that are unique to each node
  fields: Field[]; 

  // optional, can be overriden as needed
  tableName?: string;

  // reusable functionality in each schema
  patterns?: Pattern[];
}

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

let nodeFields: Field[] = [].concat([
    {
      name: "ID",
      type: {
        dbType: DBType.UUID,
      },
      primaryKey: true,
    },
  ], 
  tsFields,
);

// Node is a Pattern that adds 3 fields to the ent: (id, createdAt, and updatedAt timestamps) 
export const Node = {
  fields: nodeFields,
};

// Base ent schema. has Node Pattern by default.
// exists just to have less typing and easier for clients to implement
export abstract class BaseEntSchema {
  patterns: Pattern[] = [Node];
}
