import {
  Ent,
  ID,
  Viewer,
  Data,
  EntConstructor,
  PrivacyPolicy,
  LoadEntOptions,
} from "../core/base";
import { AlwaysAllowPrivacyPolicy } from "../core/privacy";
import { Orchestrator } from "../action/orchestrator";
import {
  Action,
  Builder,
  Changeset,
  WriteOperation,
  Validator,
  Trigger,
  saveBuilder,
  saveBuilderX,
  Observer,
} from "../action";
import { getFields, getFieldsWithPrivacy, FieldMap, Schema } from "../schema";
import { QueryRecorder } from "./db_mock";
import pluralize from "pluralize";
import { ObjectLoaderFactory } from "../core/loaders";
import { convertDate } from "../core/convert";
import {
  SchemaConfig,
  EntSchema,
  EntSchemaWithTZ,
} from "../schema/base_schema";
import { FieldInfoMap, getStorageKey } from "../schema/schema";
import { Clause } from "../core/clause";
import { ChangesetOptions } from "../action/action";
import { toDBColumnOrTable, toFieldName } from "../names/names";

export class BaseEnt {
  readonly id: ID;

  constructor(
    public viewer: Viewer,
    public readonly data: Data,
  ) {
    this.data.created_at = convertDate(data.created_at);
    this.data.updated_at = convertDate(data.updated_at);
    this.id = data[this.getKey()];
  }

  getKey() {
    return "id";
  }

  getPrivacyPolicy(): PrivacyPolicy {
    return AlwaysAllowPrivacyPolicy;
  }
  __setRawDBData(data: Data) {
    // doesn't apply here so ignore...
  }
}

export class AnyEnt implements Ent {
  nodeType = "Any";
  readonly id: ID;

  constructor(
    public viewer: Viewer,
    public readonly data: Data,
  ) {
    this.id = data[this.getKey()];
  }

  getKey() {
    return "id";
  }

  getPrivacyPolicy(): PrivacyPolicy {
    return AlwaysAllowPrivacyPolicy;
  }
  __setRawDBData(data: Data) {
    // doesn't apply here so ignore...
  }

  static loaderOptions(
    tableName: string,
    fields: string[],
    opts?: Partial<LoadEntOptions<AnyEnt>>,
  ): LoadEntOptions<AnyEnt> {
    return {
      tableName,
      fields,
      ent: AnyEnt,
      loaderFactory: new ObjectLoaderFactory({
        tableName,
        fields,
        key: "id",
      }),
      alias: tableName[0],
      ...opts,
    };
  }
}

export class User extends BaseEnt implements Ent {
  accountID: string = "";
  nodeType = "User";
  firstName: string;

  constructor(
    public viewer: Viewer,
    public data: Data,
  ) {
    super(viewer, data);
    this.firstName = data.first_name;
  }
}

export class Event extends BaseEnt implements Ent {
  accountID: string = "";
  nodeType = "Event";
}

export class Contact extends BaseEnt implements Ent {
  accountID: string = "";
  nodeType = "Contact";
  getPrivacyPolicy(): PrivacyPolicy<this> {
    return AlwaysAllowPrivacyPolicy;
  }
}

export class Group extends BaseEnt implements Ent {
  accountID: string = "";
  nodeType = "Group";
  getPrivacyPolicy(): PrivacyPolicy<this> {
    return AlwaysAllowPrivacyPolicy;
  }
}

export class Message extends BaseEnt implements Ent {
  accountID: string = "";
  nodeType = "Message";
}

export class Address extends BaseEnt implements Ent {
  accountID: string = "";
  nodeType = "Address";
}

export interface BuilderSchema<T extends Ent> extends Schema {
  ent: EntConstructor<T>;
}

export class EntBuilderSchema<T extends Ent> extends EntSchema {
  constructor(
    public ent: EntConstructor<T>,
    cfg: SchemaConfig,
  ) {
    super(cfg);
  }
}

export function getBuilderSchema<T extends Ent>(
  cfg: SchemaConfig,
  ent: EntConstructor<T>,
): BuilderSchema<T> {
  return {
    ...new EntSchema(cfg),
    ent,
  };
}

export function getBuilderSchemaFromFields<T extends Ent>(
  fields: FieldMap,
  ent: EntConstructor<T>,
  opts?: Partial<Exclude<SchemaConfig, "fields">>,
): BuilderSchema<T> {
  return {
    ...new EntSchema({ ...opts, fields }),
    ent,
  };
}

export function getBuilderSchemaTZFromFields<T extends Ent>(
  fields: FieldMap,
  ent: EntConstructor<T>,
): BuilderSchema<T> {
  return {
    ...new EntSchemaWithTZ({ fields }),
    ent,
  };
}

export function getSchemaName(value: BuilderSchema<Ent>) {
  return value.ent.name;
}

export function getTableName(value: BuilderSchema<Ent>) {
  return pluralize(toDBColumnOrTable(value.ent.name)).toLowerCase();
}

export const getDbFields = (schema: BuilderSchema<Ent>) => {
  const fields = getFields(schema);
  const dbFields: string[] = [];
  for (const [fieldName, field] of fields) {
    dbFields.push(getStorageKey(field, fieldName));
  }
  return dbFields;
};

function randomNum(): string {
  return Math.random().toString(10).substring(2);
}

export function getFieldInfo(value: BuilderSchema<Ent>) {
  const fields = getFields(value);
  let ret: FieldInfoMap = {};
  for (const [k, f] of fields) {
    ret[k] = {
      dbCol: getStorageKey(f, k),
      // in tests (anything using SimpleBuilder), make it be the same as the fieldName
      inputKey: k,
    };
  }
  return ret;
}

type MaybeNull<T extends Ent> = T | null;
type TMaybleNullableEnt<T extends Ent> = T | MaybeNull<T>;

// reuses orchestrator and standard things
export class SimpleBuilder<
  T extends Ent,
  TExistingEnt extends TMaybleNullableEnt<T> = MaybeNull<T>,
> implements Builder<T, Viewer, TExistingEnt>
{
  ent: EntConstructor<T, Viewer>;
  placeholderID: ID;
  public orchestrator: Orchestrator<T, Data, Viewer, TExistingEnt>;
  public fields: Map<string, any>;
  nodeType: string;
  m: Map<string, any> = new Map();

  constructor(
    public viewer: Viewer,
    private schema: BuilderSchema<T>,
    fields: Map<string, any>,
    public operation: WriteOperation = WriteOperation.Insert,
    public existingEnt: TExistingEnt,
    action?:
      | Action<T, SimpleBuilder<T, TExistingEnt>, Viewer, Data, TExistingEnt>
      | undefined,
    expressions?: Map<string, Clause>,
  ) {
    // create dynamic placeholder
    // TODO: do we need to use this as the node when there's an existingEnt
    // same for generated builders.
    this.placeholderID = `$ent.idPlaceholderID$ ${randomNum()}-${schema.ent
      ?.name}`;

    if (this.operation === WriteOperation.Insert) {
      for (const [key, value] of fields) {
        if (key === "id" && value === "{id}") {
          fields.set(key, QueryRecorder.newID());
        }
      }
    }
    this.fields = fields;

    const schemaFields = getFields(schema);
    let key = "id";
    const dbFields: string[] = [];
    for (const [name, f] of schemaFields) {
      dbFields.push(getStorageKey(f, name));
    }
    if (!schemaFields.has("id") && !schemaFields.has("ID")) {
      if (schemaFields.size !== 1) {
        throw new Error(
          `no id field and multiple fields so can't deduce key. add an id field to schema`,
        );
      }
      for (const [name, _] of fields) {
        key = toDBColumnOrTable(name);
      }
    }
    this.ent = schema.ent;
    const tableName = getTableName(schema);
    this.nodeType = toFieldName(schema.ent.name);
    const fieldInfo = getFieldInfo(schema);
    this.orchestrator = new Orchestrator<T, Data, Viewer, TExistingEnt>({
      viewer: this.viewer,
      operation: operation,
      tableName: tableName,
      key,
      fieldInfo,
      loaderOptions: {
        loaderFactory: new ObjectLoaderFactory({
          tableName: tableName,
          fields: dbFields,
          key,
        }),
        ent: schema.ent,
        tableName: tableName,
        fields: dbFields,
        fieldPrivacy: getFieldsWithPrivacy(schema, fieldInfo),
      },
      builder: this,
      action: action,
      expressions,
      schema: this.schema,
      editedFields: () => {
        // to simulate what we do in generated builders where we return a new Map
        const m = new Map();
        for (const [k, v] of this.fields) {
          m.set(k, v);
        }
        return m;
      },
      updateInput: this.updateInput.bind(this),
    });
  }

  getInput(): Data {
    let ret: Data = {};
    for (const [k, v] of this.fields) {
      ret[k] = v;
    }
    return ret;
  }
  updateInput(input: Data) {
    const knownFields = getFields(this.schema);
    for (const k in input) {
      if (knownFields.has(k)) {
        this.fields.set(k, input[k]);
      } else {
        // TODO: ola 2/18/2024. we may not need both anymore?
        const sc = toDBColumnOrTable(k);
        if (knownFields.has(sc)) {
          this.fields.set(sc, input[k]);
        }
      }
    }
  }

  // store data in Builder that can be retrieved by another validator, trigger, observer later in the action
  storeData(k: string, v: any) {
    this.m.set(k, v);
  }

  // retrieve data stored in this Builder with key
  getStoredData(k: string) {
    return this.m.get(k);
  }

  build(): Promise<Changeset> {
    return this.orchestrator.build();
  }

  buildWithOptions_BETA(options: ChangesetOptions): Promise<Changeset> {
    return this.orchestrator.buildWithOptions_BETA(options);
  }

  async editedEnt(): Promise<T | null> {
    return this.orchestrator.editedEnt();
  }

  async editedEntX(): Promise<T> {
    return this.orchestrator.editedEntX();
  }

  async save(): Promise<void> {
    await saveBuilder(this);
  }

  async saveX(): Promise<void> {
    await saveBuilderX(this);
  }

  async valid(): Promise<boolean> {
    return this.orchestrator.valid();
  }

  async validX(): Promise<void> {
    return this.orchestrator.validX();
  }
}

interface viewerEntLoadFunc {
  (data: Data): Viewer | Promise<Viewer>;
}

export class SimpleAction<
  T extends Ent,
  TExistingEnt extends TMaybleNullableEnt<T> = MaybeNull<T>,
> implements
    Action<T, SimpleBuilder<T, TExistingEnt>, Viewer, Data, TExistingEnt>
{
  builder: SimpleBuilder<T, TExistingEnt>;
  viewerForEntLoad: viewerEntLoadFunc | undefined;

  constructor(
    public viewer: Viewer,
    schema: BuilderSchema<T>,
    private fields: Map<string, any>,
    operation: WriteOperation = WriteOperation.Insert,
    existingEnt: TExistingEnt,
    expressions?: Map<string, Clause>,
  ) {
    this.builder = new SimpleBuilder<T, TExistingEnt>(
      this.viewer,
      schema,
      fields,
      operation,
      existingEnt,
      this,
      expressions,
    );
  }

  getTriggers(): (
    | Trigger<T, SimpleBuilder<T>>
    | Array<Trigger<T, SimpleBuilder<T>>>
  )[] {
    return [];
  }

  getValidators(): Validator<T, SimpleBuilder<T>>[] {
    return [];
  }

  getObservers(): Observer<T, SimpleBuilder<T>>[] {
    return [];
  }

  getPrivacyPolicy() {
    return AlwaysAllowPrivacyPolicy;
  }

  __failPrivacySilently(): boolean {
    return false;
  }

  getInput() {
    const ret: Data = {};
    for (const [k, v] of this.fields) {
      ret[k] = v;
    }
    return ret;
  }

  changeset(): Promise<Changeset> {
    return this.builder.build();
  }

  changesetWithOptions_BETA(options: ChangesetOptions): Promise<Changeset> {
    return this.builder.buildWithOptions_BETA(options);
  }

  valid(): Promise<boolean> {
    return this.builder.orchestrator.valid();
  }

  validX(): Promise<void> {
    return this.builder.orchestrator.validX();
  }

  validWithErrors() {
    return this.builder.orchestrator.validWithErrors();
  }

  async save(): Promise<T | null> {
    await saveBuilder(this.builder);
    if (this.builder.operation !== WriteOperation.Delete) {
      return this.builder.orchestrator.editedEnt();
    }
    return null;
  }

  async saveX(): Promise<T> {
    await saveBuilderX(this.builder);
    return this.builder.orchestrator.editedEntX();
  }

  async editedEnt(): Promise<T | null> {
    return this.builder.orchestrator.editedEnt();
  }

  async editedEntX(): Promise<T> {
    return this.builder.orchestrator.editedEntX();
  }
}
