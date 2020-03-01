export default interface Schema {
  fields: Field[]; 

  // optional, can be overriden as needed
  tableName?: string;
}

// we want --strictNullChecks flag so nullable is used to type graphql, ts, db
// should eventually generate (boolean | null) etc

// supported db types
export enum DBType {
  UUID, 
  Int64ID, // unsupported right now
  Boolean,
  Int,
  Float,
  String,
  Time,
  JSON, // tuple, lists, everything else converges on this
}

export interface Type {
  dbType: DBType; // type in the db
  // TODO make these required eventually once we get there
  type?: string; // typescript type
  graphQLType?: string // graphql type
}

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
}


// Field interface that each Field needs to support
export interface Field extends FieldOptions {
  // type of field. db, typescript, graphql types encoded in here
  type: Type; 

  // optional valid and format to validate and format before storing
  valid?(val: any):boolean;
  format?(val: any):any;
}
