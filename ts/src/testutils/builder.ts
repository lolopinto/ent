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
import { Schema } from "../schema";
import { QueryRecorder } from "./db_mock";
import pluralize from "pluralize";
import { snakeCase } from "snake-case";

export class User implements Ent {
  id: ID;
  accountID: string;
  nodeType = "User";
  privacyPolicy = AlwaysAllowPrivacyPolicy;

  constructor(public viewer: Viewer, id: ID, public data: Data) {
    this.id = id;
  }
}

export class Event implements Ent {
  id: ID;
  accountID: string;
  nodeType = "Event";
  privacyPolicy = AlwaysAllowPrivacyPolicy;

  constructor(public viewer: Viewer, id: ID, public data: Data) {
    this.id = id;
  }
}

export class Contact implements Ent {
  id: ID;
  accountID: string;
  nodeType = "Contact";
  privacyPolicy = AlwaysAllowPrivacyPolicy;

  constructor(public viewer: Viewer, id: ID, public data: Data) {
    this.id = id;
  }
}

export class Group implements Ent {
  id: ID;
  accountID: string;
  nodeType = "Group";
  privacyPolicy = AlwaysAllowPrivacyPolicy;

  constructor(public viewer: Viewer, id: ID, public data: Data) {
    this.id = id;
  }
}

export class Message implements Ent {
  id: ID;
  accountID: string;
  nodeType = "Message";
  privacyPolicy = AlwaysAllowPrivacyPolicy;

  constructor(public viewer: Viewer, id: ID, public data: Data) {
    this.id = id;
  }
}

export class Address implements Ent {
  id: ID;
  accountID: string;
  nodeType = "Address";
  privacyPolicy = AlwaysAllowPrivacyPolicy;

  constructor(public viewer: Viewer, id: ID, public data: Data) {
    this.id = id;
  }
}

export interface BuilderSchema<T extends Ent> extends Schema {
  ent: EntConstructor<T>;
}

function randomNum(): string {
  return Math.random()
    .toString(10)
    .substring(2);
}

// reuses orchestrator and standard things
export class SimpleBuilder<T extends Ent> implements Builder<T> {
  ent: EntConstructor<T>;
  placeholderID: ID;
  public orchestrator: Orchestrator<T>;
  public fields: Map<string, any>;

  constructor(
    public viewer: Viewer,
    private schema: BuilderSchema<T>,
    fields: Map<string, any>,
    public operation: WriteOperation = WriteOperation.Insert,
    public existingEnt: Ent | undefined = undefined,
    action?: Action<T> | undefined,
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

    this.ent = schema.ent;
    this.orchestrator = new Orchestrator<T>({
      viewer: this.viewer,
      operation: operation,
      tableName: pluralize(snakeCase(this.ent.name)).toLowerCase(),
      ent: this.ent,
      builder: this,
      action: action,
      schema: this.schema,
      editedFields: () => {
        return this.fields;
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

export class SimpleAction<T extends Ent> implements Action<T> {
  builder: SimpleBuilder<T>;
  validators: Validator<T>[] = [];
  triggers: Trigger<T>[] = [];
  observers: Observer<T>[] = [];
  viewerForEntLoad: viewerEntLoadFunc | undefined;

  constructor(
    public viewer: Viewer,
    schema: BuilderSchema<T>,
    private fields: Map<string, any>,
    operation: WriteOperation = WriteOperation.Insert,
    existingEnt: T | undefined = undefined,
  ) {
    this.builder = new SimpleBuilder(
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
    return this.fields;
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
      return await this.builder.orchestrator.editedEnt();
    }
    return null;
  }

  async saveX(): Promise<T> {
    await saveBuilderX(this.builder);
    return await this.builder.orchestrator.editedEntX();
  }

  async editedEnt(): Promise<T | null> {
    return await this.builder.orchestrator.editedEnt();
  }
}
