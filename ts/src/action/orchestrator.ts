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
} from "../core/ent";
import { getFields, SchemaInputType, Edge } from "../schema/schema";
import { Changeset, Executor, Validator, Trigger } from "../action";
import { WriteOperation, Builder, Action } from "../action";
import { snakeCase } from "snake-case";
import { applyPrivacyPolicyX } from "../core/privacy";
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

// hmm is it worth having multiple types here or just having one?
// todo may just change this to just ent and remove generics...
interface EdgeInputData<T2 extends Ent> {
  edgeType: string;
  id: Builder<T2> | ID; // when an OutboundEdge, this is the id2, when an inbound edge, this is the id1
  nodeType?: string; // expected to be set for WriteOperation.Insert and undefined for WriteOperation.Delete
  options?: AssocEdgeInputOptions;
}

enum edgeDirection {
  inboundEdge,
  outboundEdge,
}

interface internalEdgeInputData extends EdgeInputData<Ent> {
  direction: edgeDirection;
}

export class Orchestrator<T extends Ent> {
  private edgeSet: Set<string> = new Set<string>();
  // wowza this is a lot lol
  private edges: Map<
    string,
    Map<WriteOperation, Map<string, internalEdgeInputData>>
  > = new Map();
  private validatedFields: {} | null;
  private changesets: Changeset<T>[] = [];
  private dependencies: Map<ID, Builder<T>> = new Map();
  private fieldsToResolve: string[] = [];
  private mainOp: DataOperation | null;

  constructor(private options: OrchestratorOptions<T>) {}

  private addEdge(edge: internalEdgeInputData, op: WriteOperation) {
    this.edgeSet.add(edge.edgeType);

    let m1: Map<WriteOperation, Map<string, internalEdgeInputData>> =
      this.edges.get(edge.edgeType) || new Map();
    let m2: Map<string, internalEdgeInputData> = m1.get(op) || new Map();
    let id = edge.id.toString(); // TODO confirm that toString for builder is placeholderID. if not, add it or change this...
    // set or overwrite the new edge data for said id
    m2.set(id, edge);
    m1.set(op, m2);
    this.edges.set(edge.edgeType, m1);
  }

  addInboundEdge<T2 extends Ent>(
    id1: ID | Builder<T2>,
    edgeType: string,
    nodeType: string,
    options?: AssocEdgeInputOptions,
  ) {
    this.addEdge(
      {
        id: id1,
        edgeType,
        nodeType,
        options,
        direction: edgeDirection.inboundEdge,
      },
      WriteOperation.Insert,
    );
  }

  addOutboundEdge<T2 extends Ent>(
    id2: ID | Builder<T2>,
    edgeType: string,
    nodeType: string,
    options?: AssocEdgeInputOptions,
  ) {
    this.addEdge(
      {
        id: id2,
        edgeType,
        nodeType,
        options,
        direction: edgeDirection.outboundEdge,
      },
      WriteOperation.Insert,
    );
  }

  removeInboundEdge(id1: ID, edgeType: string) {
    this.addEdge(
      {
        id: id1,
        edgeType,
        direction: edgeDirection.inboundEdge,
      },
      WriteOperation.Delete,
    );
  }

  removeOutboundEdge(id2: ID, edgeType: string) {
    this.addEdge(
      {
        id: id2,
        edgeType,
        direction: edgeDirection.outboundEdge,
      },
      WriteOperation.Delete,
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

  // edgeType e.g. EdgeType.OrganizationToArchivedMembers
  // add | remove
  // operation e.g. WriteOperation.Insert or WriteOperation.Delete
  // and then what's the format to return and how do we deal with placeholders?
  // { id: ID | Builder<Ent>}
  // or we push the resolving to the end and return the raw data?
  // seems like the best approach...
  // so if you pass a builder, you get it back
  // and can pass it to the other e.g. removeEdge
  //
  private getEdgeOperation(
    edgeType: string,
    op: WriteOperation,
    edge: internalEdgeInputData,
  ): EdgeOperation {
    if (op === WriteOperation.Insert) {
      if (!edge.nodeType) {
        throw new Error(`no nodeType for edge when adding outboundEdge`);
      }
      if (edge.direction === edgeDirection.outboundEdge) {
        return EdgeOperation.outboundEdge(
          this.options.builder,
          edgeType,
          edge.id,
          edge.nodeType,
          edge.options,
        );
      } else {
        return EdgeOperation.inboundEdge(
          this.options.builder,
          edgeType,
          edge.id,
          edge.nodeType,
        );
      }
    } else if (op === WriteOperation.Delete) {
      if (this.isBuilder(edge.id)) {
        throw new Error("removeEdge APIs don't take a builder as an argument");
      }
      let id2 = edge.id as ID;

      if (edge.direction === edgeDirection.outboundEdge) {
        return EdgeOperation.removeOutboundEdge(
          this.options.builder,
          edgeType,
          id2,
        );
      } else {
        return EdgeOperation.removeInboundEdge(
          this.options.builder,
          edgeType,
          id2,
        );
      }
    }
    throw new Error(
      "could not find an edge operation from the given parameters",
    );
  }

  private async buildEdgeOps(ops: DataOperation[]): Promise<void> {
    const edgeDatas = await loadEdgeDatas(...Array.from(this.edgeSet.values()));
    for (const [edgeType, m] of this.edges) {
      for (const [op, m2] of m) {
        for (const [_, edge] of m2) {
          let edgeOp = this.getEdgeOperation(edgeType, op, edge);
          ops.push(edgeOp);
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
      let triggerPromises: Promise<Changeset<T> | Changeset<T>[]>[] = [];

      triggers.forEach((trigger) => {
        let c = trigger.changeset(builder);
        if (c) {
          triggerPromises.push(c);
        }
      });
      // TODO right now trying to parallelize this with validateFields below
      // may need to run triggers first to be deterministic
      // TODO: see https://github.com/lolopinto/ent/pull/50
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
    triggerPromises: Promise<Changeset<T> | Changeset<T>[]>[],
  ): Promise<void> {
    // keep changesets to use later
    let changesets: (Changeset<T> | Changeset<T>[])[] = await Promise.all(
      triggerPromises,
    );
    changesets.forEach((c) => {
      if (Array.isArray(c)) {
        this.changesets.push(...c);
      } else {
        this.changesets.push(c);
      }
    });
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
          throw new Error("existing ent required with operation");
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
        if (field.valid) {
          // TODO this could be async. handle this better
          let valid = await Promise.resolve(field.valid(value));
          if (!valid) {
            throw new Error(`invalid field ${field.name} with value ${value}`);
          }
        }

        if (field.format) {
          // TODO this could be async e.g. password. handle this better
          value = await Promise.resolve(field.format(value));
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
      this.options,
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
    private options?: OrchestratorOptions<T>,
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
        this.options,
      );
    }
    return new ListBasedExecutor(
      this.viewer,
      this.placeholderID,
      this.ent,
      this.operations,
      this.options,
    );
  }
}
