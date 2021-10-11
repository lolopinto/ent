import { Data, Ent } from "../core/base";
import { Builder } from "../action/action";

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
  edgeGroups?: AssocEdgeGroup[];

  actions?: Action[];

  // treat the single primary key as enums
  // (it's possible to have other values too..)
  enumTable?: boolean;

  // data that should be saved in the db corresponding for this table
  // keys should map to either field names or storage_key
  dbRows?: { [key: string]: any }[];

  // constraints applied to the schema e.g. multi-fkey, multi-column unique keys, join table primary keys etc
  constraints?: Constraint[];

  indices?: Index[];

  // hide a node from graphql
  // this automatically hides all related actions to it from graphql
  // AND hides all edges pointing to it since we can't return this object
  hideFromGraphQL?: boolean;
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
  edgeActions?: EdgeAction[];
  hideFromGraphQL?: boolean;
  // use this instead of the default generated const names
  edgeConstName?: string;
}

// type PickKey<T, K extends keyof T> = Extract<keyof T, K>;
// type EdgeActionOperation = PickKey<
//   typeof ActionOperation,
//   "AddEdge",
//   "RemoveEdge"
// >;

export interface EdgeAction {
  // TODO ideally this only requires AddEdge|RemoveEdge but can't get it to work (yet)
  //  operation: EdgeActionOperation;
  operation: ActionOperation;
  //   ActionOperation,
  //   ActionOperation.AddEdge | ActionOperation.RemoveEdge
  // >;
  actionName?: string;
  hideFromGraphQL?: boolean;
  graphQLName?: string;
  actionOnlyFields?: ActionField[];
}

// Information about the inverse edge of an assoc edge
export interface InverseAssocEdge {
  // name of the inverse edge
  name: string;
  // same as in AssocEdge
  edgeConstName?: string;
}

export interface EdgeGroupAction {
  // TODO ideally this only requires AddEdge|RemoveEdge but can't get it to work (yet)
  //  operation: EdgeActionOperation;
  operation: ActionOperation.EdgeGroup; // implied and don't put it?
  //   ActionOperation,
  //   ActionOperation.AddEdge | ActionOperation.RemoveEdge
  // >;
  actionName?: string;
  hideFromGraphQL?: boolean;
  graphQLName?: string;
  actionOnlyFields?: ActionField[];
}

// interface AssocEdgeNullState {
//   name: string;
//   fnName: string;
// }

// AssocEdgeGroup provides a way to group related edges together
// e.g. rsvps and you have an invited, attending, declined edge all together in the same
// table and a way to configure it so that changing one edge also affects the others
export interface AssocEdgeGroup {
  name: string;
  groupStatusName: string; // e.g. EventRsvpStatus
  tableName?: string;
  assocEdges: AssocEdge[];
  statusEnums?: string[]; // if present, restrict to these instead of all given enums...
  //  extraEnums:
  // either single item or should be list with way to differentiate btw them...
  // nullStates are not part of input, just output...
  nullStates: string | string[];
  // if more than one nullState. must pass this in
  nullStateFn?: string;
  //  nullStates?: string | AssocEdgeNullState[]; // if the edge doesn't exist, return this instead
  ///  rest
  // edgeAction -> where a setRsvp yes/no is best
  edgeAction?: EdgeGroupAction;
}

// edges we support from the schema
// there are some implied edges that are derived from fields: foreignKeys/fieldEdges
// writing to those fields automatically writes to the defined edges
// TODO other edges such as join tables 3-way id1->id2 (data)
// TODO clean this up with 1-1, 1-many, many-many etc
export type Edge = AssocEdge;

// Pattern is reusable functionality that leads to code sharing
// The most commonly used pattern in the ent framework is going to be the Node pattern
// which automatically provides 3 fields to every ent: id, created_at, updated_at
export interface Pattern {
  // breaking change. we use it to identify patterns
  name: string;
  fields: Field[];
  edges?: Edge[];
}

// we want --strictNullChecks flag so nullable is used to type graphql, ts, db
// should eventually generate (boolean | null) etc

// supported db types
export enum DBType {
  UUID = "UUID",
  Int64ID = "Int64ID", // unsupported right now
  Boolean = "Boolean",
  Int = "Int",
  BigInt = "BigInt",
  Float = "Float",
  String = "String",
  //
  Timestamp = "Timestamp",
  Timestamptz = "Timestamptz",
  JSON = "JSON", //JSON type in the database
  JSONB = "JSONB", // JSONB type in the database Postgres
  Enum = "Enum", // enum type in the database
  StringEnum = "StringEnum", // string type in the database

  Date = "Date",
  Time = "Time",
  Timetz = "Timetz",

  List = "List",
}

export interface ImportType {
  path: string; // path to import from. either absolute path e.g. from an npm package or relative path starting at root of code e.g. "src/foo/jsonType"
  type: string; // type being imported
}

declare type EnumMap = {
  [key: string]: string;
};

// represents the type of each field
export interface Type {
  dbType: DBType; // type in the db
  // if DBType is a list, we need this for what list type
  // e.g. text[], integer[] in postgres
  // For SQLite, we'll just store as text and json encode/decode
  listElemType?: Type;
  // TODO make these required eventually once we get there
  type?: string; // typescript type
  graphQLType?: string; // graphql type
  values?: string[]; // values e.g. enum values
  // TODO need to refactor this into type specific objects instead of killing the top level field like this.
  enumMap?: EnumMap; // enumMap e.g. k->v pair for enums
  importType?: ImportType;
}

export interface ForeignKey {
  schema: string;
  column: string;
  name?: string; // optional but if we have multiple foreign keys to the same schema, it becomes required for all but one
  // defaults to pluralize(schema) if not provided
  disableIndex?: boolean;
}

export interface FieldEdge {
  schema: string;
  inverseEdge: string;
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
  hideFromGraphQL?: boolean;
  private?: boolean;
  sensitive?: boolean;
  graphqlName?: string;
  index?: boolean;
  foreignKey?: ForeignKey;
  fieldEdge?: FieldEdge;
  primaryKey?: boolean; // can only have one in a schema. Node provides id as default primary key in a schema

  // indicates that this can't be edited by the user
  // must have a defaultValueOnCreate() field if set
  disableUserEditable?: boolean;
  defaultValueOnCreate?(builder: Builder<Ent>, input: Data): any;
  // shorthand for defaultValueOnCreate: (builder)=>builder.viewer.viewerID;
  // exists for common scenario to set a field to the logged in viewerID.
  defaultToViewerOnCreate?: boolean;
  defaultValueOnEdit?(builder: Builder<Ent>, input: Data): any;
  // this is very specific.
  // maybe there's a better way to indicate this
  // we sometimes have actionOnlyFields when an action creates a child object and we want to skip
  // including derived fields in the actionOnlyField created in the parent
  derivedWhenEmbedded?: boolean;

  polymorphic?: boolean | PolymorphicOptions;
  derivedFields?: Field[];
}

export interface PolymorphicOptions {
  // restrict to just these types
  types?: string[];
  // hide inverse type from graphql
  hideFromInverseGraphQL?: boolean;
}

// Field interface that each Field needs to support
export interface Field extends FieldOptions {
  // type of field. db, typescript, graphql types encoded in here
  type: Type;

  // optional valid and format to validate and format before storing
  valid?(val: any): boolean;
  //valid?(val: any): Promise<boolean>;
  format?(val: any): any;

  logValue(val: any): any;
}

export interface SchemaConstructor {
  new (): Schema;
}

export type SchemaInputType = Schema | SchemaConstructor;

function isSchema(value: SchemaInputType): value is Schema {
  return (value as Schema).fields !== undefined;
}

export function getFields(value: SchemaInputType): Map<string, Field> {
  let schema: Schema;
  if (isSchema(value)) {
    schema = value;
  } else {
    schema = new value();
  }

  function addFields(fields: Field[]) {
    for (const field of fields) {
      const derivedFields = field.derivedFields;
      if (derivedFields !== undefined) {
        addFields(derivedFields);
      }
      m.set(field.name, field);
    }
  }

  let m = new Map();
  if (schema.patterns) {
    for (const pattern of schema.patterns) {
      addFields(pattern.fields);
    }
  }
  addFields(schema.fields);

  return m;
}

// this maps to ActionOperation in ent/action.go
export enum ActionOperation {
  // Create generates a create action for the ent. If no fields are provided, uses all fields
  // on the ent. Doesn't include private fields if no fields are provided.
  Create = 1,
  // Edit generates an edit action for the ent. If no fields are provided, uses all fields
  // on the ent. Can have multiple EditActions with different fields provided. Doesn't include
  // private fields if no fields are provided.
  Edit = 2,
  // Delete generates a delete action for the ent.
  Delete = 4,
  // Mutations is a shortcut to generate create, edit, and delete actions for an ent
  // Can be used to boostrap ents or for simple ents where the granularity of actions is overkill
  // Provides CUD	of CRUD. Can be the default for most ents. Should rarely be used for the `User` or `Account` ent
  Mutations = 8,
  // AddEdge is used to provide the ability to add an edge in an AssociationEdge.
  AddEdge = 16,
  // RemoveEdge is used to provide the ability to remove an edge in an AssociationEdge.
  RemoveEdge = 32,
  // EdgeGroup is used to provide the ability to edit an edge group in an AssociationEdgeGroup.
  EdgeGroup = 64,
}

type actionFieldType =
  | "ID"
  | "Boolean"
  | "Int"
  | "Float"
  | "String"
  | "Time"
  | "Object";
// TODO...
//  | Array<actionFieldType>;

type NullableListOptions = "contents" | "contentsAndList";

export interface ActionField {
  name: string;
  // Type with no db component
  // currently a subset of DBType. could be expanded in the future
  type: actionFieldType;
  // TODO can support overriding later but for now, this is fine
  nullable?: boolean | NullableListOptions;
  // list of something
  list?: boolean;
  actionName?: string; // take the fields of this action and add them as this. only works with type "Object"
}

// provides a way to configure the actions generated for the ent
export interface Action {
  operation: ActionOperation;
  fields?: string[];
  actionName?: string;
  inputName?: string;
  graphQLName?: string;
  hideFromGraphQL?: boolean;

  // only allowed for actionOnlyField
  actionOnlyFields?: ActionField[];
}

// sentinel that indicates an action has no fields
// should be the only field in an action
// required to differentiate against default value of no fields being set to indicate
// all fields in a create/edit mutation
export const NoFields = "__NO_FIELDS__";

export function requiredField(field: string) {
  return `__required__.${field}.__required__`;
}

export function optionalField(field: string) {
  return `__optional__.${field}.__optional__`;
}

// no nullable constraint here since simple enough it's just part of the field
export interface Constraint {
  name: string;
  type: ConstraintType;
  columns: string[];
  fkey?: ForeignKeyInfo;
  condition?: string; // only applies in check constraint
}

export interface Index {
  name: string;
  columns: string[];
  unique?: boolean; // can also create a unique constraint this way because why not...
}

export interface ForeignKeyInfo {
  tableName: string;
  ondelete?: "RESTRICT" | "CASCADE" | "SET NULL" | "SET DEFAULT" | "NO ACTION";
  columns: string[];
  // no on update, match full etc
}

export enum ConstraintType {
  PrimaryKey = "primary",
  ForeignKey = "foreign",
  Unique = "unique",
  Check = "check",
  // index not a constraint and will be its own indices field
}
