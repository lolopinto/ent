import { snakeCase } from "snake-case";
import { Data, Ent, LoaderInfo, PrivacyPolicy, Viewer } from "../core/base";
import { Builder } from "../action/action";
import { Clause } from "../core/clause";
import { AssocEdgeInput } from "../core/ent";

export declare type FieldMap = {
  [key: string]: Field;
};

interface FieldInfo {
  dbCol: string;
  inputKey: string;
}

export type FieldInfoMap = {
  [key: string]: FieldInfo;
};

export interface GlobalSchema {
  // source is ¯\_(ツ)_/¯
  // this api works fine for external to int
  // internal to external, we need to solve ala polymorphic
  // internal to internal, why is this here
  edges?: Edge[];

  // e.g. deleted_at for edges
  extraEdgeFields?: FieldMap;

  transformEdgeRead?: () => Clause;
  transformEdgeWrite?: (
    stmt: EdgeUpdateOperation,
  ) => TransformedEdgeUpdateOperation | null;
}

// Schema is the base for every schema in typescript
export default interface Schema {
  // schema has list of fields that are unique to each node
  fields: FieldMap | Field[];

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

  // should this be indexes?
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
  name: string;
  fields: FieldMap | Field[];
  disableMixin?: boolean;
  edges?: Edge[];

  // can only have one thing transforming a select
  // transform to loader instead?
  // we can change generated loader to do this instead of what we're doing here
  transformRead?: () => Clause;
  transformWrite?: <T extends Ent>(
    stmt: UpdateOperation<T>,
  ) => TransformedUpdateOperation<T> | null;

  // can only have one pattern in an object which transforms each
  // if we do, it throws an Error
  // it also simplifies what we call?
  //  transformsSelect?: boolean;
  transformsDelete?: boolean;
  transformsInsert?: boolean;
  transformsUpdate?: boolean;
}

// we also want this transformation to exist on a per-action basis
// if it exists on an action, we don't do the global schema transformation

export enum SQLStatementOperation {
  // transform insert e.g. to an update based on whatever logic
  Insert = "insert",

  // // transform select e.g. deleted_at. can't change from select to different query type
  // // but can change the query
  // Select = "select",

  // e.g. change updated value
  Update = "update",

  // delete -> update theoretically e.g. deleted_at
  Delete = "delete",
}

export interface EdgeUpdateOperation {
  op: SQLStatementOperation;
  edge: AssocEdgeInput;
}

export interface TransformedEdgeUpdateOperation {
  op: SQLStatementOperation;

  // data to write to db for this edge
  data?: Data;
}

export interface UpdateOperation<
  TEnt extends Ent<TViewer>,
  TViewer extends Viewer = Viewer,
> {
  // TODO how should this affect builder.operation?
  op: SQLStatementOperation;
  builder: Builder<TEnt, TViewer>;
  // input. same input that's passed to Triggers, Observers, Validators. includes action-only fields
  input: Data;
  // data that'll be saved in the db
  data?: Map<string, any>;
}

export interface TransformedUpdateOperation<T extends Ent> {
  op: SQLStatementOperation;

  data?: Data;

  // if changing to an update, we want to return the ent
  // TODO don't have a way to delete the ent e.g. update -> insert
  existingEnt?: T | null;
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
  IntEnum = "IntEnum", // int type in the database

  Date = "Date",
  Time = "Time",
  Timetz = "Timetz",

  List = "List",
}

export interface ImportType {
  path: string; // path to import from. either absolute path e.g. from an npm package or relative path starting at root of code e.g. "src/foo/jsonType"
  type: string; // type being imported
  // for importPath, import conversion to go
  [x: string]: any;
}

declare type EnumMap = {
  [key: string]: string;
};

declare type IntEnumMap = {
  [key: string]: number;
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
  intEnumMap?: IntEnumMap;
  deprecatedIntEnumMap?: IntEnumMap;

  // @deprecated eventually kill this
  importType?: ImportType;

  // StructType fields
  subFields?: FieldMap;

  // UnionType fields. really StructMap but don't want circular dependency...
  unionFields?: FieldMap;
}

export interface ForeignKey {
  schema: string;
  column: string;
  name?: string; // optional but if we have multiple foreign keys to the same schema, it becomes required for all but one
  // defaults to pluralize(schema) if not provided
  disableIndex?: boolean;
  // disable generating Builder<Ent> in Builder and Action. helpful
  // to simplify the code when it's known that the object here
  // would always have been previously created. simplifies validation
  disableBuilderType?: boolean;
}

type getLoaderInfoFn = (type: string) => LoaderInfo;

export interface InverseFieldEdge {
  // 1-N if field exists so no need for inverse or symmetric edge. also can't be unique

  // name of the inverse edge
  name: string;
  // following 3: same as in AssocEdge
  edgeConstName?: string;
  tableName?: string;
  hideFromGraphQL?: boolean;
}

export interface FieldEdge {
  schema: string;
  // inverseEdge is optional. if present, indicates it maps to an edge in the other schema
  // it creates the edge in the other schema if not provided.
  // this makes it so that we can define and write the edge from this schema
  inverseEdge?: string | InverseFieldEdge;

  // if enforceSchema. implement the valid type.
  // we use getLoaderOptions to do it
  enforceSchema?: boolean;
  // pass the generated getLoaderInfoFromSchema method in src/ent/generated/loaders.ts
  getLoaderInfoFromSchema?: getLoaderInfoFn;
  // disable generating Builder<Ent> in Builder and Action. helpful
  // to simplify the code when it's known that the object here
  // would always have been previously created. simplifies validation
  disableBuilderType?: boolean;
}

interface PrivateOptions {
  exposeToActions?: boolean;
}

// FieldOptions are configurable options for fields.
// Can be combined with options for specific field types as neededs
export interface FieldOptions {
  // optional modification of fields: nullable/storagekey etc.
  nullable?: boolean;
  storageKey?: string; // db?
  serverDefault?: any;
  unique?: boolean;
  hideFromGraphQL?: boolean;
  // private automatically hides from graphql and actions
  // but you may want something which is private and visible in actions
  // e.g. because you have custom code you want to run in the accessors
  private?: boolean | PrivateOptions;
  sensitive?: boolean;
  graphqlName?: string;
  index?: boolean;
  foreignKey?: ForeignKey;
  fieldEdge?: FieldEdge;
  primaryKey?: boolean; // can only have one in a schema. Node provides id as default primary key in a schema

  // indicates that this can't be edited by the user
  // must have a defaultValueOnCreate() field if set
  disableUserEditable?: boolean;
  // indicates that this can't be edited by the user in graphql
  // must have a defaultValueOnCreate() field if set
  // helpful for migrations or fields that we wanna edit in code but not expose to the world
  disableUserGraphQLEditable?: boolean;
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

  // FYI. copied in config.ts
  // field can have privacy policy
  // there's 2 modes of how this is treated that can be configured in ent.yml because it affects codegen
  // 1: evaluate at the time of ent load, we apply the privacy of each object and then apply the privacy of every
  // field which has field privacy and set the property to null if the field is not visible to the viewer
  // The underlying column is no longer in the `data` field of the object
  // 2: generate accessors for the field and all callsites which reference that field will use that.
  // the privacy will be evaluated on demand when needed
  privacyPolicy?: PrivacyPolicy | (() => PrivacyPolicy);

  // takes the name of the field and returns any fields which are derived from current field
  getDerivedFields?(name: string): FieldMap;

  // allow name for now
  [x: string]: any;
}

export interface PolymorphicOptions {
  // restrict to just these types
  types?: string[];
  // hide inverse type from graphql
  hideFromInverseGraphQL?: boolean;
  // disable generating Builder<Ent> in Builder and Action. helpful
  // to simplify the code when it's known that the object here
  // would always have been previously created. simplifies validation
  disableBuilderType?: boolean;
}

// Field interface that each Field needs to support
export interface Field extends FieldOptions {
  // type of field. db, typescript, graphql types encoded in here
  type: Type;

  // optional valid and format to validate and format before storing
  valid?(val: any): Promise<boolean> | boolean;
  // optional second param which if passed and true indicates that this is a nested object
  // and should only format children and not format lists or objects
  format?(val: any, nested?: boolean): any;

  logValue(val: any): any;
}

export interface SchemaConstructor {
  new (): Schema;
}

export type SchemaInputType = Schema | SchemaConstructor;

function isSchema(value: SchemaInputType): value is Schema {
  return (value as Schema).fields !== undefined;
}

export function getSchema(value: SchemaInputType): Schema {
  if (isSchema(value)) {
    return value;
  } else {
    return new value();
  }
}

export function getFields(value: SchemaInputType): Map<string, Field> {
  const schema = getSchema(value);
  function addFields(fields: FieldMap | Field[]) {
    if (Array.isArray(fields)) {
      for (const field of fields) {
        const name = field.name;
        if (!name) {
          throw new Error(`name required`);
        }
        if (field.getDerivedFields !== undefined) {
          addFields(field.getDerivedFields(name));
        }
        m.set(name, field);
      }
      return;
    }
    for (const name in fields) {
      const field = fields[name];
      if (field.getDerivedFields !== undefined) {
        addFields(field.getDerivedFields(name));
      }
      m.set(name, field);
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

/**
 * @deprecated should only be used by tests
 */
export function getStorageKey(field: Field, fieldName: string): string {
  return field.storageKey || snakeCase(fieldName);
}

// returns a mapping of storage key to field privacy
export function getFieldsWithPrivacy(
  value: SchemaInputType,
  fieldMap: FieldInfoMap,
): Map<string, PrivacyPolicy> {
  const schema = getSchema(value);
  function addFields(fields: FieldMap | Field[]) {
    if (Array.isArray(fields)) {
      for (const field of fields) {
        const name = field.name;
        if (!field.name) {
          throw new Error(`name required`);
        }
        if (field.getDerivedFields !== undefined) {
          addFields(field.getDerivedFields(name));
        }
        if (field.privacyPolicy) {
          let privacyPolicy: PrivacyPolicy;
          if (typeof field.privacyPolicy === "function") {
            privacyPolicy = field.privacyPolicy();
          } else {
            privacyPolicy = field.privacyPolicy;
          }
          const info = fieldMap[name];
          if (!info) {
            throw new Error(`field with name ${name} not passed in fieldMap`);
          }
          m.set(info.dbCol, privacyPolicy);
        }
      }
      return;
    }
    for (const name in fields) {
      const field = fields[name];
      if (field.getDerivedFields !== undefined) {
        addFields(field.getDerivedFields(name));
      }
      if (field.privacyPolicy) {
        let privacyPolicy: PrivacyPolicy;
        if (typeof field.privacyPolicy === "function") {
          privacyPolicy = field.privacyPolicy();
        } else {
          privacyPolicy = field.privacyPolicy;
        }
        const info = fieldMap[name];
        if (!info) {
          throw new Error(`field with name ${name} not passed in fieldMap`);
        }
        m.set(info.dbCol, privacyPolicy);
      }
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

export function getTransformedReadClause(
  value: SchemaInputType,
): Clause | undefined {
  const schema = getSchema(value);
  if (!schema.patterns) {
    return;
  }
  for (const p of schema.patterns) {
    // e.g. discarded_at, deleted_at, etc
    if (p.transformRead) {
      // return clause.Eq('deleted_at', null);
      return p.transformRead();
    }
  }

  return;
}

interface objectLoaderOptions {
  clause?: () => Clause | undefined;
  instanceKey?: string;
}

export function getObjectLoaderProperties(
  value: SchemaInputType,
  tableName: string,
): objectLoaderOptions | undefined {
  return {
    clause: () => getTransformedReadClause(value),
    instanceKey: `${tableName}:transformedReadClause`,
  };
}

export function getTransformedUpdateOp<
  TEnt extends Ent<TViewer>,
  TViewer extends Viewer,
>(
  value: SchemaInputType,
  stmt: UpdateOperation<TEnt, TViewer>,
): TransformedUpdateOperation<TEnt> | null {
  const schema = getSchema(value);
  if (!schema.patterns) {
    return null;
  }
  for (const p of schema.patterns) {
    if (p.transformWrite) {
      return p.transformWrite(stmt);
    }
  }
  return null;
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

  // if actionName is provided, exclude the following fields from being embedded
  // either because they can be derived or optional and don't need it
  // no validation on what can be excluded is done. things will eventually fail if done incorrectly
  excludedFields?: string[];
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

  // beta. may be removed in the future
  // https://github.com/lolopinto/ent/issues/570
  // allows changing default behavior e.g. making an optional field required
  // or excluding a field so as to not put in fields
  excludedFields?: string[];
  optionalFields?: string[];
  requiredFields?: string[];
  noFields?: boolean;
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

export interface FullTextWeight {
  // can have multiple columns with the same weight so we allow configuring this way
  A?: string[];
  B?: string[];
  C?: string[];
  D?: string[];
}

// use coalesce for all generated
export interface FullText {
  // create a generated computed stored text column for this named XXX
  // https://www.postgresql.org/docs/current/ddl-generated-columns.html
  // postgres 12+
  generatedColumnName?: string;
  // TODO full list
  // simple is practical for names
  // rename to search config
  // may eventually need different languages depending on the column
  language?: "english" | "french" | "german" | "simple";
  // search config lang column
  languageColumn?: string;
  // gin is default
  indexType?: "gin" | "gist";

  // to simplify: we only allow weights when there's a generated column so that rank is easiest ts_rank(col, ...)
  weights?: FullTextWeight;
}

export interface Index {
  name: string;
  columns: string[];
  unique?: boolean; // can also create a unique constraint this way because why not...
  fulltext?: FullText;
  // TODO support gist soon...
  // need operator class too
  // TODO https://github.com/lolopinto/ent/issues/1029
  indexType?: "gin" | "btree";
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
