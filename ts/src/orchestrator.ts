import {
  ID,
  Ent,
  Viewer,
  EntConstructor,
  AssocEdgeInputOptions,
  DataOperation,
  EdgeOperation,
  EditNodeOperation,
  DeleteNodeOperation,
  loadEdgeDatas,
} from "./ent";
import { getFields, SchemaInputType } from "./schema";
import { Changeset, Executor, Validator, Trigger } from "./action";
import { WriteOperation, Builder, Action } from "./action";
import { snakeCase } from "snake-case";
import { applyPrivacyPolicyX } from "./privacy";
import { ListBasedExecutor, ComplexExecutor } from "./executor";

export interface OrchestratorOptions<T extends Ent> {
  viewer: Viewer;
  operation: WriteOperation;
  tableName: string;
  ent: EntConstructor<T>; // should we make it nullable for delete?

  builder: Builder<T>;
  action?: Action<T>;
  schema: SchemaInputType;
  editedFields(): Map<string, any>;
}

export class Orchestrator<T extends Ent> {
  private edgeOps: EdgeOperation[] = [];
  private edgeSet: Set<string> = new Set<string>();
  private validatedFields: {} | null;
  private changesets: Changeset<T>[] = [];
  private dependencies: Map<ID, Builder<T>> = new Map();
  private fieldsToResolve: string[] = [];
  private mainOp: DataOperation | null;

  constructor(private options: OrchestratorOptions<T>) {}

  private addEdge(edge: EdgeOperation) {
    this.edgeOps.push(edge);
    this.edgeSet.add(edge.edgeInput.edgeType);
  }

  addInboundEdge<T2 extends Ent>(
    id1: ID | Builder<T2>,
    edgeType: string,
    nodeType: string,
    options?: AssocEdgeInputOptions,
  ) {
    this.addEdge(
      EdgeOperation.inboundEdge(
        this.options.builder,
        edgeType,
        id1,
        nodeType,
        options,
      ),
    );
  }

  addOutboundEdge<T2 extends Ent>(
    id2: ID | Builder<T2>,
    edgeType: string,
    nodeType: string,
    options?: AssocEdgeInputOptions,
  ) {
    this.addEdge(
      EdgeOperation.outboundEdge(
        this.options.builder,
        edgeType,
        id2,
        nodeType,
        options,
      ),
    );
  }

  removeInboundEdge(id1: ID, edgeType: string) {
    this.addEdge(
      EdgeOperation.removeInboundEdge(this.options.builder, edgeType, id1),
    );
  }

  removeOutboundEdge(id2: ID, edgeType: string) {
    this.addEdge(
      EdgeOperation.removeOutboundEdge(this.options.builder, edgeType, id2),
    );
  }

  private buildMainOp(): DataOperation {
    // this assumes we have validated fields
    switch (this.options.operation) {
      case WriteOperation.Delete:
        return new DeleteNodeOperation(this.options.builder.existingEnt!.id, {
          tableName: this.options.tableName,
        });
      default:
        this.mainOp = new EditNodeOperation(
          {
            fields: this.validatedFields!,
            tableName: this.options.tableName,
            fieldsToResolve: this.fieldsToResolve,
          },
          this.options.builder.existingEnt,
        );
        return this.mainOp;
    }
  }

  private async buildEdgeOps(ops: DataOperation[]): Promise<void> {
    const edgeDatas = await loadEdgeDatas(...Array.from(this.edgeSet.values()));
    //    console.log(edgeDatas);
    for (const edgeOp of this.edgeOps) {
      ops.push(edgeOp);

      const edgeType = edgeOp.edgeInput.edgeType;
      const edgeData = edgeDatas.get(edgeType);
      if (!edgeData) {
        throw new Error(`could not load edge data for ${edgeType}`);
      }

      if (edgeData.symmetricEdge) {
        ops.push(edgeOp.symmetricEdge());
      }

      if (edgeData.inverseEdgeType) {
        ops.push(edgeOp.inverseEdge(edgeData));
      }
    }
  }

  private async validate(): Promise<void> {
    let privacyPolicy = this.options.action?.privacyPolicy;
    const builder = this.options.builder;

    let promises: Promise<any>[] = [];
    if (privacyPolicy) {
      promises.push(
        applyPrivacyPolicyX(
          this.options.viewer,
          privacyPolicy,
          builder.existingEnt,
        ),
      );
    }

    // have to run triggers which update fields first before field and other validators
    // so running this first to build things up
    let triggers = this.options.action?.triggers;
    if (triggers) {
      let triggerPromises: Promise<Changeset<T>>[] = [];

      triggers.forEach((trigger) => {
        let c = trigger.changeset(builder);
        if (c) {
          triggerPromises.push(c);
        }
      });
      // TODO right now trying to parallelize this with validateFields below
      // may need to run triggers first to be deterministic
      promises.push(this.triggers(triggerPromises));
    }

    promises.push(this.validateFields());

    let validators = this.options.action?.validators || [];
    if (validators) {
      promises.push(this.validators(validators, builder));
    }

    await Promise.all(promises);
  }

  private async triggers(
    triggerPromises: Promise<Changeset<T>>[],
  ): Promise<void> {
    // keep changesets to use later
    this.changesets = await Promise.all(triggerPromises);
  }

  private async validators(
    validators: Validator<T>[],
    builder: Builder<T>,
  ): Promise<void> {
    let promises: Promise<void>[] = [];
    validators.forEach((validator) => {
      let res = validator.validate(builder);
      if (res) {
        promises.push(res);
      }
    });
    await Promise.all(promises);
  }

  private isBuilder(val: any): val is Builder<T> {
    return (val as Builder<T>).placeholderID !== undefined;
  }

  private async validateFields(): Promise<void> {
    // existing ent required for edit or delete operations
    switch (this.options.operation) {
      case WriteOperation.Delete:
      case WriteOperation.Edit:
        if (!this.options.builder.existingEnt) {
          throw new Error("existing ent required with delete operation");
        }
    }

    if (this.options.operation == WriteOperation.Delete) {
      return;
    }

    const editedFields = this.options.editedFields();
    // build up data to be saved...
    let data = {};
    const schemaFields = getFields(this.options.schema);
    for (const [fieldName, field] of schemaFields) {
      let value = editedFields.get(fieldName);
      let dbKey = field.storageKey || snakeCase(field.name);

      if (value === undefined) {
        if (
          field.defaultValueOnCreate &&
          this.options.operation === WriteOperation.Insert
        ) {
          value = field.defaultValueOnCreate();
        }

        if (
          field.defaultValueOnEdit &&
          this.options.operation === WriteOperation.Edit
        ) {
          value = field.defaultValueOnEdit();
          // TODO special case this if this is the onlything changing and don't do the write.
        }
      }

      if (value === null) {
        if (!field.nullable) {
          throw new Error(
            `field ${field.name} set to null for non-nullable field`,
          );
        }
      } else if (value === undefined) {
        if (
          !field.nullable &&
          this.options.operation === WriteOperation.Insert
        ) {
          throw new Error(`required field ${field.name} not set`);
        }
      } else if (this.isBuilder(value)) {
        let builder = value;
        // keep track of dependencies to resolve
        this.dependencies.set(builder.placeholderID, builder);
        // keep track of fields to resolve
        this.fieldsToResolve.push(dbKey);
      } else {
        if (field.valid && !field.valid(value)) {
          throw new Error(`invalid field ${field.name} with value ${value}`);
        }

        if (field.format) {
          value = field.format(value);
        }
      }

      if (value !== undefined) {
        data[dbKey] = value;
      }
    }

    this.validatedFields = data;
  }

  async valid(): Promise<boolean> {
    try {
      await this.validate();
    } catch (e) {
      return false;
    }
    return true;
  }

  async validX(): Promise<void> {
    return this.validate();
  }

  async build(): Promise<EntChangeset<T>> {
    // validate everything first
    await this.validX();

    let ops: DataOperation[] = [this.buildMainOp()];
    await this.buildEdgeOps(ops);

    return new EntChangeset(
      this.options.viewer,
      this.options.builder.placeholderID,
      this.options.ent,
      ops,
      this.dependencies,
      this.changesets,
    );
  }

  // we don't do privacy checks here but will eventually
  async editedEnt(): Promise<T | null> {
    if (this.mainOp && this.mainOp.returnedEntRow) {
      // TODO we need to apply privacy while loading
      // so we also need an API to get the raw object back e.g. for account creation
      // or a way to inject viewer for privacy purposes
      // return applyPrivacyPolicyForEnt(builder.viewer, ent);
      let row = this.mainOp.returnedEntRow();
      if (row) {
        return new this.options.ent(this.options.viewer, row["id"], row);
      }
    }
    return null;
  }

  async editedEntX(): Promise<T> {
    let ent = await this.editedEnt();
    if (ent) {
      return ent;
    }
    throw new Error(`ent was not created`);
  }
}

export class EntChangeset<T extends Ent> implements Changeset<T> {
  constructor(
    public viewer: Viewer,
    public readonly placeholderID: ID,
    public readonly ent: EntConstructor<T>,
    public operations: DataOperation[],
    public dependencies?: Map<ID, Builder<T>>,
    public changesets?: Changeset<T>[],
  ) {}

  executor(): Executor<T> {
    // TODO: write comment here similar to go
    // if we have dependencies but no changesets, we just need a simple
    // executor and depend on something else in the stack to handle this correctly
    if (this.changesets?.length) {
      return new ComplexExecutor(
        this.viewer,
        this.placeholderID,
        this.ent,
        this.operations,
        this.dependencies!,
        this.changesets!,
      );
    }
    return new ListBasedExecutor(
      this.viewer,
      this.placeholderID,
      this.ent,
      this.operations,
    );
  }
}
