//import Field from "./field"

export default interface Schema {
  fields: Field[]; 

  // optional, can be overriden as needed
  tableName?: string;
}

// Field as a class.
export interface Field {
  name: string; 
  type: string; // TODO types as enum? if so, how do we do custom types?

  // TODO types as DataType which have default implementations e.g. Number, (int/float/specific number for db and other precision)
  // DataType has db type and other specific things that are used for codeegn and migration etc

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
