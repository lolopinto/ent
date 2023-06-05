import {
  ID,
  Data,
  Ent,
  Viewer,
  LoadEntOptions,
  PrivacyError,
  PrivacyPolicy,
  CreateRowOptions,
} from "../core/base";
import {
  loadEdgeDatas,
  applyPrivacyPolicyForRow,
  parameterizedQueryOptions,
} from "../core/ent";
import {
  getFields,
  SchemaInputType,
  Field,
  getTransformedUpdateOp,
  SQLStatementOperation,
  TransformedUpdateOperation,
  FieldInfoMap,
  getFieldsWithEditPrivacy,
} from "../schema/schema";
import {
  Changeset,
  ChangesetOptions,
  Executor,
  Validator,
} from "../action/action";
import {
  AssocEdgeInputOptions,
  DataOperation,
  EdgeOperation,
  EditNodeOperation,
  DeleteNodeOperation,
  EditNodeOptions,
  AssocEdgeOptions,
  ConditionalOperation,
  ConditionalNodeOperation,
} from "./operations";
import { WriteOperation, Builder, Action } from "../action";
import { applyPrivacyPolicy, applyPrivacyPolicyX } from "../core/privacy";
import { ListBasedExecutor, ComplexExecutor } from "./executor";
import { log } from "../core/logger";
import { Trigger } from "./action";
import memoize from "memoizee";
import * as clause from "../core/clause";
import { types } from "util";
import { RawQueryOperation } from "./operations";

type MaybeNull<T extends Ent> = T | null;
type TMaybleNullableEnt<T extends Ent> = T | MaybeNull<T>;

export interface OrchestratorOptions<
  TEnt extends Ent<TViewer>,
  TInput extends Data,
  TViewer extends Viewer,
  TExistingEnt extends TMaybleNullableEnt<TEnt> = MaybeNull<TEnt>,
> {
  viewer: TViewer;
  operation: WriteOperation;
  tableName: string;
  // should we make it nullable for delete?
  loaderOptions: LoadEntOptions<TEnt, TViewer>;
  // key, usually 'id' that's being updated
  key: string;

  builder: Builder<TEnt, TViewer, TExistingEnt>;
  action?: Action<TEnt, Builder<TEnt, TViewer>, TViewer, TInput>;
  schema: SchemaInputType;
  editedFields(): Map<string, any> | Promise<Map<string, any>>;
  // this is called with fields with defaultValueOnCreate|Edit
  updateInput?: (data: TInput) => void;

  // mapping of column to expressions to use
  // if set and a column exists, we use the expression here instead of the given expression in the sql query
  // for now, only works in an `UPDATE` query i.e. with operation === WriteOperation.Insert
  // if passed with a different operation type, it throws an Error
  // any value provided in editedFields for this value is ignored and we assume the right thing is done with said expression

  // TODO ability to get expression value, parse it and update it
  // e.g. if somehow there's a promotion if you play your 1000th game (which costs 5 tokens),
  // we increase your balance by 1000000 after the cost of the ticket
  // or we completely use your balance or something
  expressions?: Map<string, clause.Clause>;
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

function getViewer(viewer: Viewer) {
  if (!viewer.viewerID) {
    return "Logged out Viewer";
  } else {
    return `Viewer with ID ${viewer.viewerID}`;
  }
}

class EntCannotCreateEntError extends Error implements PrivacyError {
  privacyPolicy: PrivacyPolicy;
  constructor(privacyPolicy: PrivacyPolicy, action: Action<Ent, Builder<Ent>>) {
    let msg = `${getViewer(action.viewer)} does not have permission to create ${
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
    action: Action<Ent, Builder<Ent>>,
    ent: Ent,
  ) {
    let msg = `${getViewer(action.viewer)} does not have permission to edit ${
      ent.constructor.name
    }`;
    super(msg);
    this.privacyPolicy = privacyPolicy;
  }
}

class EntCannotEditEntFieldError extends Error implements PrivacyError {
  privacyPolicy: PrivacyPolicy;
  constructor(
    privacyPolicy: PrivacyPolicy,
    viewer: Viewer,
    field: string,
    ent: Ent,
  ) {
    let msg = `${getViewer(
      viewer,
    )} does not have permission to edit field ${field} ${ent.constructor.name}`;
    super(msg);
    this.privacyPolicy = privacyPolicy;
  }
}

class EntCannotDeleteEntError extends Error implements PrivacyError {
  privacyPolicy: PrivacyPolicy;
  constructor(
    privacyPolicy: PrivacyPolicy,
    action: Action<Ent, Builder<Ent>>,
    ent: Ent,
  ) {
    let msg = `${getViewer(action.viewer)} does not have permission to delete ${
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
  userDefinedKeys: Set<string>;
  editPrivacyFields: Map<string, PrivacyPolicy>;
}

export class Orchestrator<
  TEnt extends Ent<TViewer>,
  TInput extends Data,
  TViewer extends Viewer,
  TExistingEnt extends TMaybleNullableEnt<TEnt> = MaybeNull<TEnt>,
> {
  private edgeSet: Set<string> = new Set<string>();
  private edges: EdgeMap = new Map();
  private conditionalEdges: EdgeMap = new Map();
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
  private onConflict: CreateRowOptions["onConflict"] | undefined;
  private memoizedGetFields: () => Promise<fieldsInfo>;

  constructor(
    private options: OrchestratorOptions<TEnt, TInput, TViewer, TExistingEnt>,
  ) {
    this.viewer = options.viewer;
    this.actualOperation = this.options.operation;
    this.existingEnt = this.options.builder.existingEnt;
    this.memoizedGetFields = memoize(this.getFieldsInfo.bind(this));
  }

  // don't type this because we don't care
  __getOptions(): OrchestratorOptions<any, any, any, any> {
    return this.options;
  }

  private addEdge(
    edge: edgeInputData,
    op: WriteOperation,
    conditional?: boolean,
  ) {
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
    if (conditional && this.onConflict) {
      this.conditionalEdges.set(edge.edgeType, m1);
    } else {
      this.edges.set(edge.edgeType, m1);
    }
  }

  setDisableTransformations(val: boolean) {
    this.disableTransformations = val;
  }

  setOnConflictOptions(onConflict: CreateRowOptions["onConflict"]) {
    if (onConflict?.onConflictConstraint && !onConflict.updateCols) {
      throw new Error(`cannot set onConflictConstraint without updateCols`);
    }
    this.onConflict = onConflict;
  }

  addInboundEdge<T2 extends Ent>(
    id1: ID | Builder<T2, any>,
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
      options?.conditional,
    );
  }

  addOutboundEdge<T2 extends Ent>(
    id2: ID | Builder<T2, any>,
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
      options?.conditional,
    );
  }

  removeInboundEdge(id1: ID, edgeType: string, options?: AssocEdgeOptions) {
    this.addEdge(
      new edgeInputData({
        id: id1,
        edgeType,
        direction: edgeDirection.inboundEdge,
      }),
      WriteOperation.Delete,
      options?.conditional,
    );
  }

  removeOutboundEdge(id2: ID, edgeType: string, options?: AssocEdgeOptions) {
    this.addEdge(
      new edgeInputData({
        id: id2,
        edgeType,
        direction: edgeDirection.outboundEdge,
      }),
      WriteOperation.Delete,
      options?.conditional,
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

  private buildMainOp(conditionalBuilder?: Builder<any>): DataOperation {
    // this assumes we have validated fields
    switch (this.actualOperation) {
      case WriteOperation.Delete:
        return new DeleteNodeOperation(
          this.existingEnt!.id,
          this.options.builder,
          {
            tableName: this.options.tableName,
          },
        );
      default:
        if (this.actualOperation === WriteOperation.Edit && !this.existingEnt) {
          throw new Error(
            `existing ent required with operation ${this.actualOperation}`,
          );
        }
        if (
          this.options.expressions &&
          this.actualOperation !== WriteOperation.Edit
        ) {
          throw new Error(
            `expressions are only supported in edit operations for now`,
          );
        }
        const opts: EditNodeOptions<TEnt> = {
          fields: this.validatedFields!,
          tableName: this.options.tableName,
          fieldsToResolve: this.fieldsToResolve,
          key: this.options.key,
          loadEntOptions: this.options.loaderOptions,
          whereClause: clause.Eq(this.options.key, this.existingEnt?.id),
          expressions: this.options.expressions,
          onConflict: this.onConflict,
          builder: this.options.builder,
        };
        if (this.logValues) {
          opts.fieldsToLog = this.logValues;
        }
        this.mainOp = new EditNodeOperation(opts, this.existingEnt);
        if (conditionalBuilder) {
          this.mainOp = new ConditionalNodeOperation(
            this.mainOp,
            conditionalBuilder,
          );
        }
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

  private async buildEdgeOps(
    ops: DataOperation[],
    conditionalBuilder: Builder<any>,
    conditionalOverride: boolean,
  ): Promise<void> {
    const edgeDatas = await loadEdgeDatas(...Array.from(this.edgeSet.values()));
    const edges: [EdgeMap, boolean][] = [
      [this.edges, false],
      [this.conditionalEdges, true],
    ];
    // conditional should only apply if onconflict...
    // if no upsert and just create, nothing to do here
    for (const edgeInfo of edges) {
      const [edges, conditionalEdge] = edgeInfo;
      const conditional = conditionalOverride || conditionalEdge;
      for (const [edgeType, m] of edges) {
        for (const [op, m2] of m) {
          for (const [_, edge] of m2) {
            let edgeOp = this.getEdgeOperation(edgeType, op, edge);
            if (conditional) {
              ops.push(new ConditionalOperation(edgeOp, conditionalBuilder));
            } else {
              ops.push(edgeOp);
            }
            const edgeData = edgeDatas.get(edgeType);
            if (!edgeData) {
              throw new Error(`could not load edge data for '${edgeType}'`);
            }

            if (edgeData.symmetricEdge) {
              let symmetric: DataOperation = edgeOp.symmetricEdge();
              if (conditional) {
                symmetric = new ConditionalOperation(
                  symmetric,
                  conditionalBuilder,
                );
              }
              ops.push(symmetric);
            }

            if (edgeData.inverseEdgeType) {
              let inverse: DataOperation = edgeOp.inverseEdge(edgeData);
              if (conditional) {
                inverse = new ConditionalOperation(inverse, conditionalBuilder);
              }
              ops.push(inverse);
            }
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

  private async getRowForPrivacyPolicyImpl(
    schemaFields: Map<string, Field>,
    editedData: Data,
  ): Promise<Data> {
    // need to format fields if possible because ent constructors expect data that's
    // in the format that's coming from the db
    // required for object fields...

    const formatted = { ...editedData };
    for (const [fieldName, field] of schemaFields) {
      if (!field.format) {
        continue;
      }

      let dbKey = this.getStorageKey(fieldName);
      let val = formatted[dbKey];
      if (!val) {
        continue;
      }

      if (field.valid) {
        let valid = field.valid(val);
        if (types.isPromise(valid)) {
          valid = await valid;
        }
        // if not valid, don't format and don't pass to ent?
        // or just early throw here
        if (!valid) {
          continue;
          // throw new Error(`invalid field ${fieldName} with value ${val}`);
        }
      }

      // nested so it's not JSON stringified or anything like that
      val = field.format(formatted[dbKey], true);
      if (types.isPromise(val)) {
        val = await val;
      }

      formatted[dbKey] = val;
    }
    return formatted;
  }

  private async getEntForPrivacyPolicyImpl(
    schemaFields: Map<string, Field>,
    editedData: Data,
    viewerToUse: TViewer,
    rowToUse?: Data,
  ): Promise<TEnt> {
    if (this.actualOperation !== WriteOperation.Insert) {
      return this.existingEnt!;
    }

    if (!rowToUse) {
      rowToUse = await this.getRowForPrivacyPolicyImpl(
        schemaFields,
        editedData,
      );
    }

    // we create an unsafe ent to be used for privacy policies
    return new this.options.builder.ent(viewerToUse, rowToUse);
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
    const { schemaFields, editedData } = await this.memoizedGetFields();
    return this.getEntForPrivacyPolicyImpl(
      schemaFields,
      editedData,
      this.options.viewer,
    );
  }

  // this gets the fields that were explicitly set plus any default or transformed values
  // mainly exists to get default fields e.g. default id to be used in triggers
  // NOTE: this API may change in the future
  // doesn't work to get ids for autoincrement keys
  async getEditedData() {
    const { editedData } = await this.memoizedGetFields();
    return editedData;
  }

  /**
   * @returns validated and formatted fields that would be written to the db
   * throws an error if called before valid() or validX() has been called
   */
  getValidatedFields() {
    if (this.validatedFields === null) {
      throw new Error(
        `trying to call getValidatedFields before validating fields`,
      );
    }
    return this.validatedFields;
  }

  // Note: this is memoized. call memoizedGetFields instead
  private async getFieldsInfo(): Promise<fieldsInfo> {
    const action = this.options.action;
    const builder = this.options.builder;

    // future optimization: can get schemaFields to memoize based on different values
    const schemaFields = getFields(this.options.schema);
    // also future optimization, no need to go through the list of fields multiple times
    const editPrivacyFields = getFieldsWithEditPrivacy(
      this.options.schema,
      this.options.fieldInfo,
    );

    const editedFields = await this.options.editedFields();

    let { data: editedData, userDefinedKeys } =
      await this.getFieldsWithDefaultValues(
        builder,
        schemaFields,
        editedFields,
        action,
      );

    return {
      editedData,
      editedFields,
      schemaFields,
      userDefinedKeys,
      editPrivacyFields,
    };
  }

  private async validate(): Promise<Error[]> {
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

    const { schemaFields, editedData, userDefinedKeys, editPrivacyFields } =
      await this.memoizedGetFields();
    const action = this.options.action;
    const builder = this.options.builder;

    // this runs in following phases:
    // * set default fields and pass to builder so the value can be checked by triggers/observers/validators
    // * privacy policy (use unsafe ent if we have it)
    // * triggers
    // * validators
    let privacyPolicy = action?.getPrivacyPolicy();

    const errors: Error[] = [];

    if (privacyPolicy) {
      const ent = await this.getEntForPrivacyPolicyImpl(
        schemaFields,
        editedData,
        this.options.viewer,
      );

      try {
        await applyPrivacyPolicyX(this.options.viewer, privacyPolicy, ent, () =>
          this.throwError(),
        );
      } catch (err) {
        errors.push(err);
      }
    }

    // we have edit privacy fields, so we need to apply privacy policy on those
    const promises: Promise<void>[] = [];
    if (editPrivacyFields.size) {
      // get row based on edited data
      const row = await this.getRowForPrivacyPolicyImpl(
        schemaFields,
        editedData,
      );
      // get viewer for ent load based on formatted row
      const viewer = await this.viewerForEntLoad(row);

      const ent = await this.getEntForPrivacyPolicyImpl(
        schemaFields,
        editedData,
        viewer,
        row,
      );

      for (const [k, policy] of editPrivacyFields) {
        if (editedData[k] === undefined || !userDefinedKeys.has(k)) {
          continue;
        }
        promises.push(
          (async () => {
            const r = await applyPrivacyPolicy(viewer, policy, ent);
            if (!r) {
              errors.push(
                new EntCannotEditEntFieldError(policy, viewer, k, ent!),
              );
            }
          })(),
        );
      }
      await Promise.all(promises);
    }

    // privacy or field errors should return first so it's less confusing
    if (errors.length) {
      return errors;
    }

    // have to run triggers which update fields first before field and other validators
    // so running this first to build things up
    if (action?.getTriggers) {
      await this.triggers(action!, builder, action.getTriggers());
    }

    let validators: Validator<TEnt, Builder<TEnt, TViewer>, TViewer, TInput>[] =
      [];
    if (action?.getValidators) {
      validators = action.getValidators();
    }

    // not ideal we're calling this twice. fix...
    // needed for now. may need to rewrite some of this?
    const editedFields2 = await this.options.editedFields();
    const [errs2, errs3] = await Promise.all([
      this.formatAndValidateFields(schemaFields, editedFields2),
      this.validators(validators, action!, builder),
    ]);
    errors.push(...errs2);
    errors.push(...errs3);
    return errors;
  }

  private async triggers(
    action: Action<TEnt, Builder<TEnt, TViewer>, TViewer, TInput>,
    builder: Builder<TEnt, TViewer>,
    triggers: Array<
      | Trigger<TEnt, Builder<TEnt, TViewer>>
      | Array<Trigger<TEnt, Builder<TEnt, TViewer>>>
    >,
  ): Promise<void> {
    let groups: Trigger<TEnt, Builder<TEnt, TViewer>>[][] = [];
    let lastArray = 0;
    let prevWasArray = false;
    for (let i = 0; i < triggers.length; i++) {
      let t = triggers[i];
      if (Array.isArray(t)) {
        if (!prevWasArray) {
          // @ts-ignore
          groups.push(triggers.slice(lastArray, i));
        }
        groups.push(t);

        prevWasArray = true;
        lastArray++;
      } else {
        if (i === triggers.length - 1) {
          // @ts-ignore
          groups.push(triggers.slice(lastArray, i + 1));
        }
        prevWasArray = false;
      }
    }

    for (const triggers of groups) {
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
  }

  private async validators(
    validators: Validator<TEnt, Builder<TEnt, TViewer>, TViewer, TInput>[],
    action: Action<TEnt, Builder<TEnt, TViewer>, TViewer, TInput>,
    builder: Builder<TEnt, TViewer>,
  ): Promise<Error[]> {
    const errors: Error[] = [];
    await Promise.all(
      validators.map(async (v) => {
        try {
          const r = await v.validate(builder, action.getInput());
          if (r instanceof Error) {
            errors.push(r);
          }
        } catch (err) {
          errors.push(err as Error);
        }
      }),
    );
    return errors;
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
    builder: Builder<TEnt, TViewer>,
    schemaFields: Map<string, Field>,
    editedFields: Map<string, any>,
    action?: Action<TEnt, Builder<TEnt, TViewer>, TViewer, TInput> | undefined,
  ): Promise<Data> {
    let data: Data = {};
    let defaultData: Data = {};

    let input: Data = action?.getInput() || {};

    let updateInput = false;

    // transformations
    // if action transformations. always do it
    // if disable transformations set, don't do schema transform and just do the right thing
    // else apply schema tranformation if it exists
    let transformed: TransformedUpdateOperation<TEnt, TViewer> | null = null;

    const sqlOp = this.getSQLStatementOperation();
    // why is transform write technically different from upsert?
    // it's create -> update just at the db level...
    if (action?.transformWrite) {
      transformed = await action.transformWrite({
        builder,
        input,
        op: sqlOp,
        data: editedFields,
      });
    } else if (!this.disableTransformations) {
      transformed = getTransformedUpdateOp<TEnt, TViewer>(this.options.schema, {
        builder,
        input,
        op: sqlOp,
        data: editedFields,
      });
    }
    if (transformed) {
      if (sqlOp === SQLStatementOperation.Insert && sqlOp !== transformed.op) {
        if (!transformed.existingEnt) {
          throw new Error(
            `cannot transform an insert operation without providing an existing ent`,
          );
        }
      }
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
      if (transformed.changeset) {
        const changeset = await transformed.changeset();
        this.changesets.push(changeset);
      }
      this.actualOperation = this.getWriteOpForSQLStamentOp(transformed.op);
      if (transformed.existingEnt) {
        // @ts-ignore
        this.existingEnt = transformed.existingEnt;
        // modify existing ent in builder. it's readonly in generated ents but doesn't apply here
        builder.existingEnt = transformed.existingEnt;
      }
    }
    // transforming before doing default fields so that we don't create a new id
    // and anything that depends on the type of operations knows what it is

    const userDefinedKeys = new Set<string>();
    for (const [fieldName, field] of schemaFields) {
      let value = editedFields.get(fieldName);
      let defaultValue: any = undefined;
      let dbKey = this.getStorageKey(fieldName);

      let updateOnlyIfOther = field.onlyUpdateIfOtherFieldsBeingSet_BETA;

      if (value !== undefined) {
        userDefinedKeys.add(dbKey);
      }

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
            if (types.isPromise(defaultValue)) {
              defaultValue = await defaultValue;
            }
          }
        }

        if (
          field.defaultValueOnEdit &&
          this.actualOperation === WriteOperation.Edit
        ) {
          defaultValue = field.defaultValueOnEdit(builder, input);
          if (types.isPromise(defaultValue)) {
            defaultValue = await defaultValue;
          }
        }
      }

      if (value !== undefined) {
        data[dbKey] = value;
      }

      if (defaultValue !== undefined) {
        updateInput = true;

        if (updateOnlyIfOther) {
          defaultData[dbKey] = defaultValue;
        } else {
          data[dbKey] = defaultValue;
        }

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
        this.options.updateInput(this.defaultFieldsByTSName as TInput);
      }
    }

    return { data, userDefinedKeys };
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
  ): Promise<Error | any> {
    // now format and validate...
    if (value === null) {
      if (!field.nullable) {
        return new Error(
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
        return new Error(`required field ${fieldName} not set`);
      }
    } else if (this.isBuilder(value)) {
      if (field.valid) {
        const valid = await field.valid(value);
        if (!valid) {
          return new Error(`invalid field ${fieldName} with value ${value}`);
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
          return new Error(`invalid field ${fieldName} with value ${value}`);
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
  ): Promise<Error[]> {
    const errors: Error[] = [];
    const op = this.actualOperation;
    if (op === WriteOperation.Delete) {
      return [];
    }

    // build up data to be saved...
    let data = {};
    let logValues = {};

    let needsFullDataChecks: string[] = [];
    for (const [fieldName, field] of schemaFields) {
      let value = editedFields.get(fieldName);

      if (field.validateWithFullData) {
        needsFullDataChecks.push(fieldName);
      }

      if (value === undefined && op === WriteOperation.Insert) {
        // null allowed
        value = this.defaultFieldsByFieldName[fieldName];
      }
      let dbKey = this.getStorageKey(fieldName);

      let ret = await this.transformFieldValue(fieldName, field, dbKey, value);
      if (ret instanceof Error) {
        errors.push(ret);
      } else {
        value = ret;
      }

      if (value !== undefined) {
        data[dbKey] = value;
        logValues[dbKey] = field.logValue(value);
      }
    }

    for (const fieldName of needsFullDataChecks) {
      const field = schemaFields.get(fieldName)!;
      let value = editedFields.get(fieldName);

      // @ts-ignore...
      // type hackery because it's hard
      const v = await field.validateWithFullData(value, this.options.builder);
      if (!v) {
        if (value === undefined) {
          errors.push(
            new Error(
              `field ${fieldName} set to undefined when it can't be nullable`,
            ),
          );
        } else {
          errors.push(
            new Error(
              `field ${fieldName} set to null when it can't be nullable`,
            ),
          );
        }
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
          const ret = await this.transformFieldValue(
            fieldName,
            field,
            dbKey,
            defaultValue,
          );
          if (ret instanceof Error) {
            errors.push(ret);
          } else {
            data[dbKey] = ret;
            logValues[dbKey] = field.logValue(ret);
          }
        }
      }
    }

    this.validatedFields = data;
    this.logValues = logValues;
    return errors;
  }

  async valid(): Promise<boolean> {
    const errors = await this.validate();
    if (errors.length) {
      errors.map((err) => log("error", err));
      return false;
    }
    return true;
  }

  async validX(): Promise<void> {
    const errors = await this.validate();
    if (errors.length) {
      // just throw the first one...
      // TODO we should ideally throw all of them
      throw errors[0];
    }
  }

  /**
   * @experimental API that's not guaranteed to remain in the future which returns
   * a list of errors encountered
   * 0 errors indicates valid
   * NOTE that this currently doesn't catch errors returned by validators().
   * If those throws, this still throws and doesn't return them
   */
  async validWithErrors(): Promise<Error[]> {
    return this.validate();
  }

  private async buildPlusChangeset(
    conditionalBuilder: Builder<any>,
    conditionalOverride: boolean,
  ): Promise<EntChangeset<TEnt>> {
    // validate everything first
    await this.validX();

    let ops: DataOperation[] = [
      this.buildMainOp(conditionalOverride ? conditionalBuilder : undefined),
    ];

    await this.buildEdgeOps(ops, conditionalBuilder, conditionalOverride);

    // TODO throw if we try and create a new changeset after previously creating one

    // TODO test actualOperation value
    // observers is fine since they're run after and we have the actualOperation value...

    return new EntChangeset(
      this.options.viewer,
      this.options.builder,
      this.options.builder.placeholderID,
      conditionalOverride,
      ops,
      this.dependencies,
      this.changesets,
      this.options,
    );
  }

  async build(): Promise<EntChangeset<TEnt>> {
    return this.buildPlusChangeset(this.options.builder, false);
  }

  async buildWithOptions_BETA(
    options: ChangesetOptions,
  ): Promise<EntChangeset<TEnt>> {
    // set as dependency so that we do the right order of operations
    this.dependencies.set(
      options.conditionalBuilder.placeholderID,
      options.conditionalBuilder,
    );
    return this.buildPlusChangeset(options.conditionalBuilder, true);
  }

  private async viewerForEntLoad(data: Data) {
    const action = this.options.action;
    if (!action || !action.viewerForEntLoad) {
      return this.options.viewer;
    }
    return action.viewerForEntLoad(data, action.builder.viewer.context);
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

function randomNum(): string {
  return Math.random().toString(10).substring(2);
}

// each changeset is required to have a unique placeholderID
// used in executor. if we end up creating multiple changesets from a builder, we need
// different placeholders
// in practice, only applies to Entchangeset::changesetFrom()
export class EntChangeset<T extends Ent> implements Changeset {
  private _executor: Executor | null;
  constructor(
    public viewer: Viewer,
    private builder: Builder<T>,
    public readonly placeholderID: ID,
    private conditionalOverride: boolean,
    public operations: DataOperation[],
    public dependencies?: Map<ID, Builder<Ent>>,
    public changesets?: Changeset[],
    private options?: OrchestratorOptions<T, Data, Viewer>,
  ) {}

  static changesetFrom(builder: Builder<any, any, any>, ops: DataOperation[]) {
    return new EntChangeset(
      builder.viewer,
      builder,
      // need unique placeholderID different from the builder. see comment above EntChangeset
      `$ent.idPlaceholderID$ ${randomNum()}-${builder.ent.name}`,
      false,
      ops,
    );
  }

  static changesetFromQueries(
    builder: Builder<any, any, any>,
    queries: Array<string | parameterizedQueryOptions>,
  ) {
    return new EntChangeset(
      builder.viewer,
      builder,
      // need unique placeholderID different from the builder. see comment above EntChangeset
      `$ent.idPlaceholderID$ ${randomNum()}-${builder.ent.name}`,
      false,
      [new RawQueryOperation(builder, queries)],
    );
  }

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
        {
          conditionalOverride: this.conditionalOverride,
          builder: this.builder,
        },
      ));
    }

    return (this._executor = new ComplexExecutor(
      this.viewer,
      this.placeholderID,
      this.operations,
      this.dependencies || new Map(),
      this.changesets || [],
      this.options,
      {
        conditionalOverride: this.conditionalOverride,
        builder: this.builder,
      },
    ));
  }
}
