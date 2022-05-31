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
import {
  getFields,
  SchemaInputType,
  Field,
  getTransformedUpdateOp,
  SQLStatementOperation,
  TransformedUpdateOperation,
  FieldInfoMap,
} from "../schema/schema";
import { Changeset, Executor, Validator } from "../action/action";
import { WriteOperation, Builder, Action } from "../action";
import { applyPrivacyPolicyX } from "../core/privacy";
import { ListBasedExecutor, ComplexExecutor } from "./executor";
import { log } from "../core/logger";
import { Trigger } from "./action";
import memoize from "memoizee";

type MaybeNull<T extends Ent> = T | null;
type TMaybleNullableEnt<T extends Ent> = T | MaybeNull<T>;

export interface OrchestratorOptions<
  TEnt extends Ent,
  TData extends Data,
  TExistingEnt extends TMaybleNullableEnt<TEnt> = MaybeNull<TEnt>,
> {
  viewer: Viewer;
  operation: WriteOperation;
  tableName: string;
  // should we make it nullable for delete?
  loaderOptions: LoadEntOptions<TEnt>;
  // key, usually 'id' that's being updated
  key: string;

  builder: Builder<TEnt, TExistingEnt>;
  action?: Action<TEnt, Builder<TEnt>, TData>;
  schema: SchemaInputType;
  editedFields(): Map<string, any> | Promise<Map<string, any>>;
  // this is called with fields with defaultValueOnCreate|Edit
  updateInput?: (data: TData) => void;
  fieldInfo: FieldInfoMap;
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

interface fieldsInfo {
  editedData: Data;
  editedFields: Map<string, any>;
  schemaFields: Map<string, Field>;
}

export class Orchestrator<
  TEnt extends Ent,
  TData extends Data,
  TExistingEnt extends TMaybleNullableEnt<TEnt> = MaybeNull<TEnt>,
> {
  private edgeSet: Set<string> = new Set<string>();
  private edges: EdgeMap = new Map();
  private validatedFields: Data | null;
  private logValues: Data | null;
  private changesets: Changeset[] = [];
  private dependencies: Map<ID, Builder<TEnt>> = new Map();
  private fieldsToResolve: string[] = [];
  private mainOp: DataOperation<TEnt> | null;
  viewer: Viewer;
  private defaultFieldsByFieldName: Data = {};
  private defaultFieldsByTSName: Data = {};
  // we can transform from one update to another so we wanna differentiate
  // btw the beginning op and the transformed one we end up using
  private actualOperation: WriteOperation;
  // same with existingEnt. can transform so we wanna know what we started with and now where we are.
  private existingEnt: TExistingEnt;
  private disableTransformations: boolean;
  private memoizedGetFields: () => Promise<fieldsInfo>;

  constructor(private options: OrchestratorOptions<TEnt, TData, TExistingEnt>) {
    this.viewer = options.viewer;
    this.actualOperation = this.options.operation;
    this.existingEnt = this.options.builder.existingEnt;
    this.memoizedGetFields = memoize(this.getFieldsInfo.bind(this));
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

  setDisableTransformations(val: boolean) {
    this.disableTransformations = val;
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
    switch (this.actualOperation) {
      case WriteOperation.Delete:
        return new DeleteNodeOperation(this.existingEnt!.id, {
          tableName: this.options.tableName,
        });
      default:
        if (this.actualOperation === WriteOperation.Edit && !this.existingEnt) {
          throw new Error(
            `existing ent required with operation ${this.actualOperation}`,
          );
        }
        const opts: EditNodeOptions<TEnt> = {
          fields: this.validatedFields!,
          tableName: this.options.tableName,
          fieldsToResolve: this.fieldsToResolve,
          key: this.options.key,
          loadEntOptions: this.options.loaderOptions,
          placeholderID: this.options.builder.placeholderID,
        };
        if (this.logValues) {
          opts.fieldsToLog = this.logValues;
        }
        this.mainOp = new EditNodeOperation(opts, this.existingEnt);
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

    if (this.actualOperation === WriteOperation.Insert) {
      return new EntCannotCreateEntError(privacyPolicy, action);
    } else if (this.actualOperation === WriteOperation.Edit) {
      return new EntCannotEditEntError(
        privacyPolicy,
        action,
        this.existingEnt!,
      );
    }
    return new EntCannotDeleteEntError(
      privacyPolicy,
      action,
      this.existingEnt!,
    );
  }

  private getEntForPrivacyPolicyImpl(editedData: Data): TEnt {
    if (this.actualOperation !== WriteOperation.Insert) {
      return this.existingEnt!;
    }
    // we create an unsafe ent to be used for privacy policies
    return new this.options.builder.ent(
      this.options.builder.viewer,
      editedData,
    );
  }

  private getSQLStatementOperation(): SQLStatementOperation {
    switch (this.actualOperation) {
      case WriteOperation.Edit:
        return SQLStatementOperation.Update;
      case WriteOperation.Insert:
        return SQLStatementOperation.Insert;
      case WriteOperation.Delete:
        return SQLStatementOperation.Delete;
    }
  }

  private getWriteOpForSQLStamentOp(op: SQLStatementOperation): WriteOperation {
    switch (op) {
      case SQLStatementOperation.Update:
        return WriteOperation.Edit;
      case SQLStatementOperation.Insert:
        return WriteOperation.Insert;
      case SQLStatementOperation.Update:
        return WriteOperation.Delete;
      default:
        throw new Error("invalid path");
    }
  }

  // if you're doing custom privacy within an action and want to
  // get either the unsafe ent or the existing ent that's being edited
  async getPossibleUnsafeEntForPrivacy(): Promise<TEnt> {
    if (this.actualOperation !== WriteOperation.Insert) {
      return this.existingEnt!;
    }
    const { editedData } = await this.memoizedGetFields();
    return this.getEntForPrivacyPolicyImpl(editedData);
  }

  // this gets the fields that were explicitly set plus any default or transformed values
  // mainly exists to get default fields e.g. default id to be used in triggers
  // NOTE: this API may change in the future
  // doesn't work to get ids for autoincrement keys
  async getEditedData() {
    const { editedData } = await this.memoizedGetFields();
    return editedData;
  }

  // Note: this is memoized. call memoizedGetFields instead
  private async getFieldsInfo() {
    const action = this.options.action;
    const builder = this.options.builder;

    // future optimization: can get schemaFields to memoize based on different values
    const schemaFields = getFields(this.options.schema);

    const editedFields = await this.options.editedFields();

    let editedData = await this.getFieldsWithDefaultValues(
      builder,
      schemaFields,
      editedFields,
      action,
    );

    return { editedData, editedFields, schemaFields };
  }

  private async validate(): Promise<void> {
    // existing ent required for edit or delete operations
    switch (this.actualOperation) {
      case WriteOperation.Delete:
      case WriteOperation.Edit:
        if (!this.existingEnt) {
          throw new Error(
            `existing ent required with operation ${this.actualOperation}`,
          );
        }
    }

    const { schemaFields, editedData } = await this.memoizedGetFields();
    const action = this.options.action;
    const builder = this.options.builder;

    // this runs in following phases:
    // * set default fields and pass to builder so the value can be checked by triggers/observers/validators
    // * privacy policy (use unsafe ent if we have it)
    // * triggers
    // * validators
    let privacyPolicy = action?.getPrivacyPolicy();
    if (privacyPolicy) {
      await applyPrivacyPolicyX(
        this.options.viewer,
        privacyPolicy,
        this.getEntForPrivacyPolicyImpl(editedData),
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

    // not ideal we're calling this twice. fix...
    // needed for now. may need to rewrite some of this?
    const editedFields2 = await this.options.editedFields();
    await Promise.all([
      this.formatAndValidateFields(schemaFields, editedFields2),
      this.validators(validators, action!, builder),
    ]);
  }

  private async triggers(
    action: Action<TEnt, Builder<TEnt>, TData>,
    builder: Builder<TEnt>,
    triggers: Trigger<TEnt, Builder<TEnt>, TData>[],
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
    validators: Validator<TEnt, Builder<TEnt>, TData>[],
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

  private getInputKey(k: string) {
    return this.options.fieldInfo[k].inputKey;
  }
  private getStorageKey(k: string) {
    return this.options.fieldInfo[k].dbCol;
  }

  private async getFieldsWithDefaultValues(
    builder: Builder<TEnt>,
    schemaFields: Map<string, Field>,
    editedFields: Map<string, any>,
    action?: Action<TEnt, Builder<TEnt>, TData> | undefined,
  ): Promise<Data> {
    let data: Data = {};
    let defaultData: Data = {};

    let input: Data = action?.getInput() || {};

    let updateInput = false;

    // transformations
    // if action transformations. always do it
    // if disable transformations set, don't do schema transform and just do the right thing
    // else apply schema tranformation if it exists
    let transformed: TransformedUpdateOperation<TEnt> | null = null;

    if (action?.transformWrite) {
      transformed = await action.transformWrite({
        viewer: builder.viewer,
        op: this.getSQLStatementOperation(),
        data: editedFields,
        existingEnt: this.existingEnt,
      });
    } else if (!this.disableTransformations) {
      transformed = getTransformedUpdateOp<TEnt>(this.options.schema, {
        viewer: builder.viewer,
        op: this.getSQLStatementOperation(),
        data: editedFields,
        existingEnt: this.existingEnt,
      });
    }
    if (transformed) {
      if (transformed.data) {
        updateInput = true;
        for (const k in transformed.data) {
          let field = schemaFields.get(k);
          if (!field) {
            throw new Error(`tried to transform field with unknown field ${k}`);
          }
          let val = transformed.data[k];
          if (field.format) {
            val = field.format(transformed.data[k]);
          }
          data[this.getStorageKey(k)] = val;
          this.defaultFieldsByTSName[this.getInputKey(k)] = val;
          // hmm do we need this?
          // TODO how to do this for local tests?
          // this.defaultFieldsByFieldName[k] = val;
        }
      }
      this.actualOperation = this.getWriteOpForSQLStamentOp(transformed.op);
      if (transformed.existingEnt) {
        // @ts-ignore
        this.existingEnt = transformed.existingEnt;
      }
    }
    // transforming before doing default fields so that we don't create a new id
    // and anything that depends on the type of operations knows what it is

    for (const [fieldName, field] of schemaFields) {
      let value = editedFields.get(fieldName);
      let defaultValue: any = undefined;
      let dbKey = this.getStorageKey(fieldName);

      if (value === undefined) {
        if (this.actualOperation === WriteOperation.Insert) {
          if (field.defaultToViewerOnCreate && field.defaultValueOnCreate) {
            throw new Error(
              `cannot set both defaultToViewerOnCreate and defaultValueOnCreate`,
            );
          }
          if (field.defaultToViewerOnCreate) {
            defaultValue = builder.viewer.viewerID;
          }
          if (field.defaultValueOnCreate) {
            defaultValue = field.defaultValueOnCreate(builder, input);
            if (defaultValue === undefined) {
              throw new Error(
                `defaultValueOnCreate() returned undefined for field ${fieldName}`,
              );
            }
          }
        }

        if (
          field.defaultValueOnEdit &&
          this.actualOperation === WriteOperation.Edit
        ) {
          defaultValue = field.defaultValueOnEdit(builder, input);
        }
      }

      if (value !== undefined) {
        data[dbKey] = value;
      }

      if (defaultValue !== undefined) {
        updateInput = true;
        defaultData[dbKey] = defaultValue;
        this.defaultFieldsByFieldName[fieldName] = defaultValue;
        this.defaultFieldsByTSName[this.getInputKey(fieldName)] = defaultValue;
      }
    }

    // if there's data changing, add data
    if (this.hasData(data)) {
      data = {
        ...data,
        ...defaultData,
      };
      if (updateInput && this.options.updateInput) {
        // this basically fixes #605. just needs to be exposed correctly
        this.options.updateInput(this.defaultFieldsByTSName as TData);
      }
    }

    return data;
  }

  private hasData(data: Data) {
    for (const _k in data) {
      return true;
    }
    return false;
  }

  private async transformFieldValue(
    fieldName: string,
    field: Field,
    dbKey: string,
    value: any,
  ) {
    // now format and validate...
    if (value === null) {
      if (!field.nullable) {
        throw new Error(
          `field ${fieldName} set to null for non-nullable field`,
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
        this.actualOperation === WriteOperation.Insert
      ) {
        throw new Error(`required field ${fieldName} not set`);
      }
    } else if (this.isBuilder(value)) {
      if (field.valid) {
        const valid = await field.valid(value);
        if (!valid) {
          throw new Error(`invalid field ${fieldName} with value ${value}`);
        }
      }
      // keep track of dependencies to resolve
      this.dependencies.set(value.placeholderID, value);
      // keep track of fields to resolve
      this.fieldsToResolve.push(dbKey);
    } else {
      if (field.valid) {
        // TODO this could be async. handle this better
        const valid = await field.valid(value);
        if (!valid) {
          throw new Error(`invalid field ${fieldName} with value ${value}`);
        }
      }

      if (field.format) {
        value = await field.format(value);
      }
    }
    return value;
  }

  private async formatAndValidateFields(
    schemaFields: Map<string, Field>,
    editedFields: Map<string, any>,
  ): Promise<void> {
    const op = this.actualOperation;
    if (op === WriteOperation.Delete) {
      return;
    }

    // build up data to be saved...
    let data = {};
    let logValues = {};

    for (const [fieldName, field] of schemaFields) {
      let value = editedFields.get(fieldName);

      if (value === undefined && op === WriteOperation.Insert) {
        // null allowed
        value = this.defaultFieldsByFieldName[fieldName];
      }
      let dbKey = this.getStorageKey(fieldName);

      value = await this.transformFieldValue(fieldName, field, dbKey, value);

      if (value !== undefined) {
        data[dbKey] = value;
        logValues[dbKey] = field.logValue(value);
      }
    }

    //  we ignored default values while editing.
    // if we're editing and there's data, add default values
    if (op === WriteOperation.Edit && this.hasData(data)) {
      for (const fieldName in this.defaultFieldsByFieldName) {
        const defaultValue = this.defaultFieldsByFieldName[fieldName];
        let field = schemaFields.get(fieldName)!;

        let dbKey = this.getStorageKey(fieldName);

        // no value, let's just default
        if (data[dbKey] === undefined) {
          const value = await this.transformFieldValue(
            fieldName,
            field,
            dbKey,
            defaultValue,
          );
          data[dbKey] = value;
          logValues[dbKey] = field.logValue(value);
        }
      }
    }

    this.validatedFields = data;
    this.logValues = logValues;
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
    if (this.mainOp && this.mainOp.returnedRow) {
      return this.mainOp.returnedRow();
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
      if (this.actualOperation == WriteOperation.Insert) {
        throw new Error(`was able to create ent but not load it`);
      } else {
        throw new Error(`was able to edit ent but not load it`);
      }
    }
    return ent;
  }
}

export class EntChangeset<T extends Ent> implements Changeset {
  private _executor: Executor | null;
  constructor(
    public viewer: Viewer,
    public readonly placeholderID: ID,
    public readonly ent: EntConstructor<T>,
    public operations: DataOperation[],
    public dependencies?: Map<ID, Builder<Ent>>,
    public changesets?: Changeset[],
    private options?: OrchestratorOptions<T, Data>,
  ) {}

  executor(): Executor {
    if (this._executor) {
      return this._executor;
    }

    if (!this.changesets?.length) {
      // if we have dependencies but no changesets, we just need a simple
      // executor and depend on something else in the stack to handle this correctly
      // ComplexExecutor which could be a parent of this should make sure the dependency
      // is resolved beforehand
      return (this._executor = new ListBasedExecutor(
        this.viewer,
        this.placeholderID,
        this.operations,
        this.options,
      ));
    }

    return (this._executor = new ComplexExecutor(
      this.viewer,
      this.placeholderID,
      this.operations,
      this.dependencies || new Map(),
      this.changesets || [],
      this.options,
    ));
  }
}
