import {
  ID,
  Data,
  Ent,
  Viewer,
  EntConstructor,
  LoadEntOptions,
  PrivacyError,
  PrivacyPolicy,
} from "../core/base";
import {
  AssocEdgeInputOptions,
  DataOperation,
  EdgeOperation,
  EditNodeOperation,
  DeleteNodeOperation,
  loadEdgeDatas,
  applyPrivacyPolicyForRow,
  EditNodeOptions,
} from "../core/ent";
import { getFields, SchemaInputType } from "../schema/schema";
import { Changeset, Executor, Validator, TriggerReturn } from "../action";
import { WriteOperation, Builder, Action } from "../action";
import { snakeCase } from "snake-case";
import { applyPrivacyPolicyX } from "../core/privacy";
import { ListBasedExecutor, ComplexExecutor } from "./executor";
import { log } from "../core/logger";
import { Trigger } from "./action";

export interface OrchestratorOptions<TEnt extends Ent, TData extends Data> {
  viewer: Viewer;
  operation: WriteOperation;
  tableName: string;
  // should we make it nullable for delete?
  loaderOptions: LoadEntOptions<TEnt>;
  // key, usually 'id' that's being updated
  key: string;

  builder: Builder<TEnt>;
  action?: Action<TEnt, Builder<TEnt>, TData>;
  schema: SchemaInputType;
  editedFields(): Map<string, any>;
}

interface edgeInputDataOpts {
  edgeType: string;
  id: Builder<Ent> | ID; // when an OutboundEdge, this is the id2, when an inbound edge, this is the id1
  nodeType?: string; // expected to be set for WriteOperation.Insert and undefined for WriteOperation.Delete
  options?: AssocEdgeInputOptions;
}

// hmm is it worth having multiple types here or just having one?
// we have one type here instead
export interface EdgeInputData extends edgeInputDataOpts {
  isBuilder(id: Builder<Ent> | ID): id is Builder<Ent>;
}

export enum edgeDirection {
  inboundEdge,
  outboundEdge,
}

interface internalEdgeInputData extends edgeInputDataOpts {
  direction: edgeDirection;
}

class edgeInputData implements EdgeInputData {
  direction: edgeDirection;
  edgeType: string;
  id: Builder<Ent> | ID;
  nodeType?: string;
  options?: AssocEdgeInputOptions;

  constructor(opts: internalEdgeInputData) {
    Object.assign(this, opts);
  }

  isBuilder(id: Builder<Ent> | ID): id is Builder<Ent> {
    return (id as Builder<Ent>).placeholderID !== undefined;
  }
}

type IDMap = Map<ID, edgeInputData>;
type OperationMap = Map<WriteOperation, IDMap>;
// this is a map of
// edgeType : {
//   WriteOperation: {
//     id: {
//       id input
//     }
//   }
// }
type EdgeMap = Map<string, OperationMap>;

function getViewer(action: Action<Ent, Builder<Ent>, Data>) {
  if (!action.viewer.viewerID) {
    return "Logged out Viewer";
  } else {
    return `Viewer with ID ${action.viewer.viewerID}`;
  }
}
class EntCannotCreateEntError extends Error implements PrivacyError {
  privacyPolicy: PrivacyPolicy;
  constructor(
    privacyPolicy: PrivacyPolicy,
    action: Action<Ent, Builder<Ent>, Data>,
  ) {
    let msg = `${getViewer(action)} does not have permission to create ${
      action.builder.ent.name
    }`;
    super(msg);
    this.privacyPolicy = privacyPolicy;
  }
}

class EntCannotEditEntError extends Error implements PrivacyError {
  privacyPolicy: PrivacyPolicy;
  constructor(
    privacyPolicy: PrivacyPolicy,
    action: Action<Ent, Builder<Ent>, Data>,
    ent: Ent,
  ) {
    let msg = `${getViewer(action)} does not have permission to edit ${
      ent.constructor.name
    }`;
    super(msg);
    this.privacyPolicy = privacyPolicy;
  }
}

class EntCannotDeleteEntError extends Error implements PrivacyError {
  privacyPolicy: PrivacyPolicy;
  constructor(
    privacyPolicy: PrivacyPolicy,
    action: Action<Ent, Builder<Ent>, Data>,
    ent: Ent,
  ) {
    let msg = `${getViewer(action)} does not have permission to delete ${
      ent.constructor.name
    }`;
    super(msg);
    this.privacyPolicy = privacyPolicy;
  }
}

export class Orchestrator<TEnt extends Ent, TData extends Data> {
  private edgeSet: Set<string> = new Set<string>();
  private edges: EdgeMap = new Map();
  private validatedFields: Data | null;
  private logValues: Data | null;
  private changesets: Changeset<Ent>[] = [];
  private dependencies: Map<ID, Builder<TEnt>> = new Map();
  private fieldsToResolve: string[] = [];
  private mainOp: DataOperation | null;
  viewer: Viewer;

  constructor(private options: OrchestratorOptions<TEnt, TData>) {
    this.viewer = options.viewer;
  }

  private addEdge(edge: edgeInputData, op: WriteOperation) {
    this.edgeSet.add(edge.edgeType);

    let m1: OperationMap = this.edges.get(edge.edgeType) || new Map();
    let m2: IDMap = m1.get(op) || new Map();
    let id: ID;
    if (edge.isBuilder(edge.id)) {
      id = edge.id.placeholderID;
    } else {
      id = edge.id;
    }
    //    let id = edge.id.toString(); // TODO confirm that toString for builder is placeholderID. if not, add it or change this...
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
      new edgeInputData({
        id: id1,
        edgeType,
        nodeType,
        options,
        direction: edgeDirection.inboundEdge,
      }),
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
      new edgeInputData({
        id: id2,
        edgeType,
        nodeType,
        options,
        direction: edgeDirection.outboundEdge,
      }),
      WriteOperation.Insert,
    );
  }

  removeInboundEdge(id1: ID, edgeType: string) {
    this.addEdge(
      new edgeInputData({
        id: id1,
        edgeType,
        direction: edgeDirection.inboundEdge,
      }),
      WriteOperation.Delete,
    );
  }

  removeOutboundEdge(id2: ID, edgeType: string) {
    this.addEdge(
      new edgeInputData({
        id: id2,
        edgeType,
        direction: edgeDirection.outboundEdge,
      }),
      WriteOperation.Delete,
    );
  }

  // this doesn't take a direction as that's an implementation detail
  // it doesn't make any sense to use the same edgeType for inbound and outbound edges
  // so no need for that
  getInputEdges(edgeType: string, op: WriteOperation): EdgeInputData[] {
    let m: IDMap = this.edges.get(edgeType)?.get(op) || new Map();
    // want a list and not an IterableIterator
    let ret: edgeInputData[] = [];
    m.forEach((v) => ret.push(v));

    return ret;
  }

  // this privides a way to clear data if needed
  // we don't have a great API for this yet
  clearInputEdges(edgeType: string, op: WriteOperation, id?: ID) {
    let m: IDMap = this.edges.get(edgeType)?.get(op) || new Map();
    if (id) {
      m.delete(id);
    } else {
      m.clear();
    }
  }

  private buildMainOp(): DataOperation {
    // this assumes we have validated fields
    switch (this.options.operation) {
      case WriteOperation.Delete:
        return new DeleteNodeOperation(this.options.builder.existingEnt!.id, {
          tableName: this.options.tableName,
        });
      default:
        const opts: EditNodeOptions = {
          fields: this.validatedFields!,
          tableName: this.options.tableName,
          fieldsToResolve: this.fieldsToResolve,
          key: this.options.key,
        };
        if (this.logValues) {
          opts.fieldsToLog = this.logValues;
        }
        this.mainOp = new EditNodeOperation(
          opts,
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
          edge.options,
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

  private throwError(): PrivacyError {
    const action = this.options.action;
    let privacyPolicy = action?.getPrivacyPolicy();
    if (!privacyPolicy || !action) {
      throw new Error(`shouldn't get here if no privacyPolicy for action`);
    }

    if (this.options.operation === WriteOperation.Insert) {
      return new EntCannotCreateEntError(privacyPolicy, action);
    } else if (this.options.operation === WriteOperation.Edit) {
      return new EntCannotEditEntError(
        privacyPolicy,
        action,
        this.options.builder.existingEnt!,
      );
    }
    return new EntCannotDeleteEntError(
      privacyPolicy,
      action,
      this.options.builder.existingEnt!,
    );
  }

  private async validate(): Promise<void> {
    const action = this.options.action;
    const builder = this.options.builder;

    // this runs in 3 phases:
    // * privacy policy
    // * triggers
    // * validators
    let privacyPolicy = action?.getPrivacyPolicy();
    if (privacyPolicy) {
      await applyPrivacyPolicyX(
        this.options.viewer,
        privacyPolicy,
        builder.existingEnt,
        this.throwError.bind(this),
      );
    }

    // have to run triggers which update fields first before field and other validators
    // so running this first to build things up
    let triggers = action?.triggers;
    if (triggers) {
      await this.triggers(action!, builder, triggers);
    }

    let validators = action?.validators || [];

    await Promise.all([
      this.validateFields(builder, action),
      this.validators(validators, action!, builder),
    ]);
  }

  private async triggers(
    action: Action<TEnt, Builder<TEnt>, TData>,
    builder: Builder<TEnt>,
    triggers: Trigger<Builder<TEnt>, TData>[],
  ): Promise<void> {
    await Promise.all(
      triggers.map(async (trigger) => {
        let ret = await trigger.changeset(builder, action.getInput());
        if (Array.isArray(ret)) {
          ret = await Promise.all(ret);
        }

        if (Array.isArray(ret)) {
          for (const v of ret) {
            if (typeof v === "object") {
              this.changesets.push(v);
            }
          }
        } else if (ret) {
          this.changesets.push(ret);
        }
      }),
    );
  }

  private async validators(
    validators: Validator<Builder<TEnt>, TData>[],
    action: Action<TEnt, Builder<TEnt>, TData>,
    builder: Builder<TEnt>,
  ): Promise<void> {
    let promises: Promise<void>[] = [];
    validators.forEach((validator) => {
      let res = validator.validate(builder, action.getInput());
      if (res) {
        promises.push(res);
      }
    });
    await Promise.all(promises);
  }

  private isBuilder(val: Builder<TEnt> | any): val is Builder<TEnt> {
    return (val as Builder<TEnt>).placeholderID !== undefined;
  }

  private async validateFields(
    builder: Builder<TEnt>,
    action?: Action<TEnt, Builder<TEnt>, TData> | undefined,
  ): Promise<void> {
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
    let logValues = {};
    const schemaFields = getFields(this.options.schema);
    let input: Data = {};
    if (action !== undefined) {
      input = action.getInput();
    }
    for (const [fieldName, field] of schemaFields) {
      let value = editedFields.get(fieldName);
      let dbKey = field.storageKey || snakeCase(field.name);

      if (value === undefined) {
        if (this.options.operation === WriteOperation.Insert) {
          if (field.defaultToViewerOnCreate && field.defaultValueOnCreate) {
            throw new Error(
              `cannot set both defaultToViewerOnCreate and defaultValueOnCreate`,
            );
          }
          if (field.defaultToViewerOnCreate) {
            value = builder.viewer.viewerID;
          }
          if (field.defaultValueOnCreate) {
            value = field.defaultValueOnCreate(builder, input);
            if (value === undefined) {
              throw new Error(
                `defaultValueOnCreate() returned undefined for field ${field.name}`,
              );
            }
          }
        }

        if (
          field.defaultValueOnEdit &&
          this.options.operation === WriteOperation.Edit
        ) {
          value = field.defaultValueOnEdit(builder, input);
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
          // required field can be skipped if server default set
          // not checking defaultValueOnCreate() or defaultValueOnEdit() as that's set above
          // not setting server default as we're depending on the database handling that.
          // server default allowed
          field.serverDefault === undefined &&
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
        logValues[dbKey] = field.logValue(value);
      }
    }

    this.validatedFields = data;
    this.logValues = logValues;
    //    console.log(this.validatedFields);
  }

  async valid(): Promise<boolean> {
    try {
      await this.validate();
    } catch (e) {
      log("error", e);
      return false;
    }
    return true;
  }

  async validX(): Promise<void> {
    return this.validate();
  }

  async build(): Promise<EntChangeset<TEnt>> {
    // validate everything first
    await this.validX();

    let ops: DataOperation[] = [this.buildMainOp()];
    await this.buildEdgeOps(ops);
    //    console.log("post build");

    return new EntChangeset(
      this.options.viewer,
      this.options.builder.placeholderID,
      this.options.loaderOptions.ent,
      ops,
      this.dependencies,
      this.changesets,
      this.options,
    );
  }

  private async viewerForEntLoad(data: Data) {
    const action = this.options.action;
    if (!action || !action.viewerForEntLoad) {
      return this.options.viewer;
    }
    return action.viewerForEntLoad(data);
  }

  async returnedRow(): Promise<Data | null> {
    if (this.mainOp && this.mainOp.returnedEntRow) {
      return this.mainOp.returnedEntRow();
    }
    return null;
  }

  async editedEnt(): Promise<TEnt | null> {
    const row = await this.returnedRow();
    if (!row) {
      return null;
    }
    const viewer = await this.viewerForEntLoad(row);
    return applyPrivacyPolicyForRow(viewer, this.options.loaderOptions, row);
  }

  async editedEntX(): Promise<TEnt> {
    const row = await this.returnedRow();
    if (!row) {
      throw new Error(`ent was not created`);
    }
    const viewer = await this.viewerForEntLoad(row);
    const ent = await applyPrivacyPolicyForRow(
      viewer,
      this.options.loaderOptions,
      row,
    );

    if (!ent) {
      if (this.options.operation == WriteOperation.Insert) {
        throw new Error(`was able to create ent but not load it`);
      } else {
        throw new Error(`was able to edit ent but not load it`);
      }
    }
    return ent;
  }
}

export class EntChangeset<T extends Ent> implements Changeset<T> {
  constructor(
    public viewer: Viewer,
    public readonly placeholderID: ID,
    public readonly ent: EntConstructor<T>,
    public operations: DataOperation[],
    public dependencies?: Map<ID, Builder<T>>,
    public changesets?: Changeset<Ent>[],
    private options?: OrchestratorOptions<T, Data>,
  ) {}

  executor(): Executor {
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
