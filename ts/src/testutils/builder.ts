import { Ent, ID, Viewer, Data, EntConstructor } from "../core/base";
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
import { getFields, getFieldsWithPrivacy, Schema } from "../schema";
import { QueryRecorder } from "./db_mock";
import pluralize from "pluralize";
import { snakeCase } from "snake-case";
import { ObjectLoaderFactory } from "../core/loaders";
import { convertDate } from "../core/convert";
import { camelCase } from "camel-case";

export class User implements Ent {
  id: ID;
  accountID: string = "";
  nodeType = "User";
  privacyPolicy = AlwaysAllowPrivacyPolicy;
  firstName: string;

  constructor(public viewer: Viewer, public data: Data) {
    this.data.created_at = convertDate(data.created_at);
    this.data.updated_at = convertDate(data.updated_at);
    this.id = data.id;
    this.firstName = data.first_name;
  }
}

export class Event implements Ent {
  id: ID;
  accountID: string = "";
  nodeType = "Event";
  privacyPolicy = AlwaysAllowPrivacyPolicy;

  constructor(public viewer: Viewer, public data: Data) {
    this.id = data.id;
  }
}

export class Contact implements Ent {
  id: ID;
  accountID: string = "";
  nodeType = "Contact";
  privacyPolicy = AlwaysAllowPrivacyPolicy;

  constructor(public viewer: Viewer, public data: Data) {
    this.data.created_at = convertDate(data.created_at);
    this.data.updated_at = convertDate(data.updated_at);
    this.id = data.id;
  }
}

export class Group implements Ent {
  id: ID;
  accountID: string = "";
  nodeType = "Group";
  privacyPolicy = AlwaysAllowPrivacyPolicy;

  constructor(public viewer: Viewer, public data: Data) {
    this.id = data.id;
  }
}

export class Message implements Ent {
  id: ID;
  accountID: string = "";
  nodeType = "Message";
  privacyPolicy = AlwaysAllowPrivacyPolicy;

  constructor(public viewer: Viewer, public data: Data) {
    this.id = data.id;
  }
}

export class Address implements Ent {
  id: ID;
  accountID: string = "";
  nodeType = "Address";
  privacyPolicy = AlwaysAllowPrivacyPolicy;

  constructor(public viewer: Viewer, public data: Data) {
    this.id = data.id;
  }
}

export interface BuilderSchema<T extends Ent> extends Schema {
  ent: EntConstructor<T>;
}

export function getSchemaName(value: BuilderSchema<Ent>) {
  return value.ent.name;
}

export function getTableName(value: BuilderSchema<Ent>) {
  return pluralize(snakeCase(value.ent.name)).toLowerCase();
}

function randomNum(): string {
  return Math.random().toString(10).substring(2);
}

// reuses orchestrator and standard things
export class SimpleBuilder<T extends Ent> implements Builder<T> {
  ent: EntConstructor<T>;
  placeholderID: ID;
  public orchestrator: Orchestrator<T, Data>;
  public fields: Map<string, any>;
  nodeType: string;

  constructor(
    public viewer: Viewer,
    private schema: BuilderSchema<T>,
    fields: Map<string, any>,
    public operation: WriteOperation = WriteOperation.Insert,
    public existingEnt: T | undefined = undefined,
    action?: Action<T, SimpleBuilder<T>, Data> | undefined,
  ) {
    // create dynamic placeholder
    // TODO: do we need to use this as the node when there's an existingEnt
    // same for generated builders.
    this.placeholderID = `$ent.idPlaceholderID$ ${randomNum()}-${
      schema.ent?.name
    }`;

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
    if (!schemaFields.has("id") && !schemaFields.has("ID")) {
      if (schemaFields.size !== 1) {
        throw new Error(
          `no id field and multiple fields so can't deduce key. add an id field to schema`,
        );
      }
      for (const [name, _] of fields) {
        key = snakeCase(name);
      }
    }
    this.ent = schema.ent;
    const tableName = getTableName(schema);
    this.nodeType = camelCase(schema.ent.name);
    this.orchestrator = new Orchestrator<T, Data>({
      viewer: this.viewer,
      operation: operation,
      tableName: tableName,
      key,
      loaderOptions: {
        loaderFactory: new ObjectLoaderFactory({
          tableName: tableName,
          fields: [],
          key,
        }),
        ent: schema.ent,
        tableName: tableName,
        fields: [],
        fieldPrivacy: getFieldsWithPrivacy(schema),
      },
      builder: this,
      action: action,
      schema: this.schema,
      editedFields: () => {
        // to simulate what we do in generated builders where we return a new Map
        const m = new Map();
        for (const [k, v] of this.fields) {
          m.set(k, v);
        }
        return m;
      },
      updateInput: (input: Data) => {
        const knownFields = getFields(this.schema);
        for (const k in input) {
          if (knownFields.has(k)) {
            this.fields.set(k, input[k]);
          } else {
            // related to #510. we do camelCase to pass fields in here but fields may be snakeCase and we want that to pass in tests
            // we do camelCase in
            const sc = snakeCase(k);
            if (knownFields.has(sc)) {
              this.fields.set(sc, input[k]);
            }
          }
        }
      },
    });
  }

  build(): Promise<Changeset<T>> {
    return this.orchestrator.build();
  }

  async editedEnt(): Promise<T | null> {
    return await this.orchestrator.editedEnt();
  }

  async editedEntX(): Promise<T> {
    return await this.orchestrator.editedEntX();
  }

  async save(): Promise<void> {
    await saveBuilder(this);
  }

  async saveX(): Promise<void> {
    await saveBuilderX(this);
  }

  async valid(): Promise<boolean> {
    return await this.orchestrator.valid();
  }

  async validX(): Promise<void> {
    return await this.orchestrator.validX();
  }
}

interface viewerEntLoadFunc {
  (data: Data): Viewer | Promise<Viewer>;
}

export class SimpleAction<T extends Ent>
  implements Action<T, SimpleBuilder<T>, Data>
{
  builder: SimpleBuilder<T>;
  validators: Validator<SimpleBuilder<T>, Data>[] = [];
  triggers: Trigger<SimpleBuilder<T>, Data>[] = [];
  observers: Observer<SimpleBuilder<T>, Data>[] = [];
  viewerForEntLoad: viewerEntLoadFunc | undefined;

  constructor(
    public viewer: Viewer,
    schema: BuilderSchema<T>,
    private fields: Map<string, any>,
    operation: WriteOperation = WriteOperation.Insert,
    existingEnt: T | undefined = undefined,
  ) {
    this.builder = new SimpleBuilder<T>(
      this.viewer,
      schema,
      fields,
      operation,
      existingEnt,
      this,
    );
  }

  getPrivacyPolicy() {
    return AlwaysAllowPrivacyPolicy;
  }

  getInput() {
    const ret: Data = {};
    for (const [k, v] of this.fields) {
      ret[k] = v;
    }
    return ret;
  }

  changeset(): Promise<Changeset<T>> {
    return this.builder.build();
  }

  valid(): Promise<boolean> {
    return this.builder.orchestrator.valid();
  }

  validX(): Promise<void> {
    return this.builder.orchestrator.validX();
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
