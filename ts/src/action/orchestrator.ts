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
  applyPrivacyPolicyForActionResult,
  parameterizedQueryOptions,
  loadEdgeData,
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
  getFieldsForCreateAction,
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
  NoOperation,
} from "./operations";
import { WriteOperation, Builder, Action } from "../action";
import { applyPrivacyPolicy, applyPrivacyPolicyX } from "../core/privacy";
import { isBuilder } from "./privacy";
import { ListBasedExecutor, ComplexExecutor } from "./executor";
import { memoizeNoArgs } from "../core/memoize";
import { log } from "../core/logger";
import { Trigger } from "./action";
import * as clause from "../core/clause";
import { isPromise } from "util/types";
import { RawQueryOperation } from "./operations";
import {
  awaitActionPreparations,
  trackValidationRead,
  assertEntTransaction,
  assertLoaderTransaction,
  assertTransactionRead,
  failTransaction,
  getTransactionReadState,
  getTransactionState,
  assertActionPreparationAllowed,
  runInActionPreparation,
  isPreparingAction,
  isValidationPreparation,
  recordActionResultTransaction,
  hasActionResultTransaction,
  recordPreparedEntTransaction,
  TransactionReadState,
} from "../core/transaction_context";

type MaybeNull<T extends Ent> = T | null;
// Expected validation and privacy failures in child builds remain recoverable
// during standalone validation. SQL and composition failures still abort the
// owning transaction.
const validationFailures = new WeakSet<Error>();
type TMaybleNullableEnt<T extends Ent> = T | MaybeNull<T>;

function invalidFieldError(fieldName: string, value: any): Error {
  let description: string;
  try {
    description = `${value}`;
  } catch {
    // Null-prototype records (and lists containing them) cannot be coerced
    // to strings. Diagnostic formatting must not hide a validation failure.
    description = "[unprintable value]";
  }
  return new Error(`invalid field ${fieldName} with value ${description}`);
}

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
  updateInput?: (data: TInput, operation?: WriteOperation) => void;

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

interface edgeInputDataOpts<
  TEnt extends Ent<TViewer>,
  TViewer extends Viewer = Viewer,
> {
  edgeType: string;
  id: Builder<TEnt, TViewer> | ID; // when an OutboundEdge, this is the id2, when an inbound edge, this is the id1
  nodeType?: string; // expected to be set for WriteOperation.Insert and undefined for WriteOperation.Delete
  options?: AssocEdgeInputOptions;
}

// hmm is it worth having multiple types here or just having one?
// we have one type here instead
export interface EdgeInputData<TViewer extends Viewer = Viewer>
  extends edgeInputDataOpts<any, TViewer> {
  isBuilder(id: Builder<any, TViewer> | ID): id is Builder<any, TViewer>;
}

export enum edgeDirection {
  inboundEdge,
  outboundEdge,
}

interface internalEdgeInputData<
  TEnt extends Ent<TViewer>,
  TViewer extends Viewer = Viewer,
> extends edgeInputDataOpts<TEnt, TViewer> {
  direction: edgeDirection;
}

class edgeInputData<TViewer extends Viewer = Viewer>
  implements EdgeInputData<TViewer>
{
  direction: edgeDirection;
  edgeType: string;
  id: Builder<any, TViewer> | ID;
  nodeType?: string;
  options?: AssocEdgeInputOptions;

  constructor(opts: internalEdgeInputData<any, TViewer>) {
    Object.assign(this, opts);
  }

  isBuilder(id: Builder<any, TViewer> | ID): id is Builder<any, TViewer> {
    return (id as Builder<any, TViewer>).placeholderID !== undefined;
  }
}

type IDMap<TViewer extends Viewer = Viewer> = Map<ID, edgeInputData<TViewer>>;
type OperationMap<TViewer extends Viewer = Viewer> = Map<
  WriteOperation,
  IDMap<TViewer>
>;
// this is a map of
// edgeType : {
//   WriteOperation: {
//     id: {
//       id input
//     }
//   }
// }
type EdgeMap<TViewer extends Viewer = Viewer> = Map<
  string,
  OperationMap<TViewer>
>;

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
    )} does not have permission to edit field ${field} in ${
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
  private edges: EdgeMap<TViewer> = new Map();
  private fieldEdgeSources = new WeakMap<edgeInputData<TViewer>, Set<string>>();
  private fieldEdgeInputs = new Map<
    string,
    {
      edgeType: string;
      nodeType: string;
      ids: readonly (ID | Builder<Ent, any>)[] | undefined;
      existingIDs: readonly ID[];
    }
  >();
  private conditionalEdges: EdgeMap<TViewer> = new Map();
  private validatedFields: Data | null = null;
  private logValues: Data | null;
  private changesets: Changeset[] = [];
  private dependencies: Map<ID, Builder<TEnt>> = new Map();
  private fieldsToResolve: string[] = [];
  private mainOp: DataOperation<TEnt, TViewer> | null;
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
  private fieldPreparationRead?: TransactionReadState;
  private transformedChangeset?: TransformedUpdateOperation<
    TEnt,
    TViewer
  >["changeset"];
  private transaction = getTransactionState();
  private preparationInProgress = false;

  constructor(
    private options: OrchestratorOptions<TEnt, TInput, TViewer, TExistingEnt>,
  ) {
    this.viewer = options.viewer;
    this.actualOperation = this.options.operation;
    this.existingEnt = this.options.builder.existingEnt;
    let prepared = false;
    const fields = memoizeNoArgs(() => {
      prepared = true;
      this.fieldPreparationRead = getTransactionReadState();
      return this.getFieldsInfo();
    });
    this.memoizedGetFields = async () => {
      // Defaults and transformations may depend on reads, even for inserts.
      // Keep IDs stable within an attempt, but reject prepared values from an
      // earlier generation. Committed actions can expose retained data outside a scope.
      if (
        getTransactionState() &&
        prepared &&
        !hasActionResultTransaction(this.options.builder)
      ) {
        assertTransactionRead(this.fieldPreparationRead);
      }
      const result = await fields();
      if (
        getTransactionState() &&
        !hasActionResultTransaction(this.options.builder)
      ) {
        assertTransactionRead(this.fieldPreparationRead);
      }
      return result;
    };
  }

  // don't type this because we don't care
  __getOptions(): OrchestratorOptions<any, any, any, any> {
    return this.options;
  }

  private addEdge(
    edge: edgeInputData<TViewer>,
    op: WriteOperation,
    conditional?: boolean,
  ) {
    this.edgeSet.add(edge.edgeType);

    let m1: OperationMap<TViewer> = this.edges.get(edge.edgeType) || new Map();
    let m2: IDMap<TViewer> = m1.get(op) || new Map();
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

  // Update inverse edges for generated fields while preserving explicit edge
  // operations. This method is internal. For edits and deletions, use stored IDs.
  // If `stored` omits `existingIDs`, reuse the IDs captured before synchronous
  // default updates.
  __setFieldEdges<T2 extends Ent>(
    fieldName: string,
    ids: readonly (ID | Builder<T2, any>)[] | undefined,
    edgeType: string,
    nodeType: string,
    stored: { existingIDs?: readonly ID[] },
  ) {
    // Existing builders and literal IDs can refer to the same database row.
    // Use placeholder IDs as queue keys so unsaved builders remain dependencies.
    const endpointID = (id: ID | Builder<Ent, any>): ID =>
      isBuilder(id) ? (id.existingEnt?.id ?? id.placeholderID) : id;
    this.fieldEdgeInputs.set(fieldName, {
      edgeType,
      nodeType,
      ids,
      existingIDs:
        stored.existingIDs ??
        this.fieldEdgeInputs.get(fieldName)?.existingIDs ??
        [],
    });
    type Contribution = { id: ID | Builder<Ent, any>; sources: Set<string> };
    const inserts = new Map<ID, Contribution>();
    const removals = new Map<ID, Contribution>();
    const retained = new Set<ID>();
    const contribute = (
      map: Map<ID, Contribution>,
      id: ID | Builder<Ent, any>,
      source: string,
    ) => {
      const key = isBuilder(id) ? id.placeholderID : id;
      let entry = map.get(key);
      if (!entry) {
        map.set(key, (entry = { id, sources: new Set() }));
      }
      entry.sources.add(source);
    };
    for (const [source, field] of this.fieldEdgeInputs) {
      if (field.edgeType !== edgeType) {
        continue;
      }
      const existing =
        this.actualOperation === WriteOperation.Insert ? [] : field.existingIDs;
      const current =
        this.actualOperation === WriteOperation.Delete ? [] : field.ids;
      for (const id of current ?? existing) {
        retained.add(endpointID(id));
      }
      if (current !== undefined) {
        for (const id of current) {
          contribute(inserts, id, source);
        }
        for (const id of existing) {
          contribute(removals, id, source);
        }
      }
    }
    const manualEndpoints = (op: WriteOperation) => {
      const endpoints = new Set<ID>();
      for (const edge of this.edges.get(edgeType)?.get(op)?.values() ?? []) {
        if (!this.fieldEdgeSources.has(edge)) {
          endpoints.add(endpointID(edge.id));
        }
      }
      return endpoints;
    };
    const manualInserts = manualEndpoints(WriteOperation.Insert);
    const manualRemovals = manualEndpoints(WriteOperation.Delete);
    for (const id of removals.keys()) {
      if (retained.has(id) || manualInserts.has(id)) {
        removals.delete(id);
      }
    }
    for (const [key, contribution] of inserts) {
      const id = endpointID(contribution.id);
      if (manualInserts.has(id) || manualRemovals.has(id)) {
        inserts.delete(key);
      }
    }
    for (const [op, desired] of [
      [WriteOperation.Insert, inserts],
      [WriteOperation.Delete, removals],
    ] as const) {
      const queued = this.edges.get(edgeType)?.get(op);
      for (const [id, edge] of queued ?? []) {
        if (!this.fieldEdgeSources.has(edge)) {
          continue;
        }
        const contribution = desired.get(id);
        if (contribution) {
          this.fieldEdgeSources.set(edge, contribution.sources);
        } else {
          queued!.delete(id);
        }
      }
      for (const [key, contribution] of desired) {
        if (this.edges.get(edgeType)?.get(op)?.has(key)) {
          continue;
        }
        const edge = new edgeInputData<TViewer>({
          id: contribution.id,
          edgeType,
          nodeType,
          direction: edgeDirection.inboundEdge,
        });
        this.fieldEdgeSources.set(edge, contribution.sources);
        this.addEdge(edge, op);
      }
    }
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
        options,
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
        options,
      }),
      WriteOperation.Delete,
      options?.conditional,
    );
  }

  // this doesn't take a direction as that's an implementation detail
  // it doesn't make any sense to use the same edgeType for inbound and outbound edges
  // so no need for that
  getInputEdges(
    edgeType: string,
    op: WriteOperation,
  ): EdgeInputData<TViewer>[] {
    let m: IDMap<TViewer> = this.edges.get(edgeType)?.get(op) || new Map();
    // want a list and not an IterableIterator
    let ret: edgeInputData<TViewer>[] = [];
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

  private buildMainOp(
    conditionalBuilder?: Builder<TEnt, TViewer>,
  ): DataOperation<TEnt, TViewer> {
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
        const opts: EditNodeOptions<TEnt, TViewer> = {
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
    edge: internalEdgeInputData<any, TViewer>,
  ): EdgeOperation<TViewer> {
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
          edge.options,
        );
      } else {
        return EdgeOperation.removeInboundEdge(
          this.options.builder,
          edgeType,
          id2,
          edge.options,
        );
      }
    }
    throw new Error(
      "could not find an edge operation from the given parameters",
    );
  }

  private async buildEdgeOps(
    ops: DataOperation<any, TViewer>[],
    conditionalBuilder: Builder<TEnt, TViewer>,
    conditionalOverride: boolean,
  ): Promise<void> {
    const edgeDatas = await loadEdgeDatas(...Array.from(this.edgeSet.values()));
    const edges: [EdgeMap<TViewer>, boolean][] = [
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
            // similar logic in EntChangeset.changesetFromEdgeOp
            // doesn't support conditional edges

            if (edgeData.symmetricEdge) {
              let symmetric: DataOperation<any, TViewer> =
                edgeOp.symmetricEdge();
              if (conditional) {
                symmetric = new ConditionalOperation(
                  symmetric,
                  conditionalBuilder,
                );
              }
              ops.push(symmetric);
            }

            if (edgeData.inverseEdgeType) {
              let inverse: DataOperation<any, TViewer> =
                edgeOp.inverseEdge(edgeData);
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
        if (isPromise(valid)) {
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
      if (isPromise(val)) {
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
    if (getTransactionState()) {
      assertTransactionRead(this.fieldPreparationRead);
    }
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
    if (getTransactionState()) {
      assertTransactionRead(this.fieldPreparationRead);
    }
    const ent = new this.options.builder.ent(viewerToUse, rowToUse);
    recordPreparedEntTransaction(ent, this.fieldPreparationRead);
    return ent;
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

  /**
   * This gets the fields that were explicitly set plus any default or transformed values
   * mainly exists to get default fields e.g. default id to be used in triggers
   * NOTE: this API may change in the future
   * doesn't work to get ids for autoincrement keys
   * PS contrasted with getValidatedFields() which returns the format that would be written to the db
   * i.e. includes lists which have been converted to JSON strings, etc
   */
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
    let editPrivacyFields = new Map<string, PrivacyPolicy>();
    switch (this.actualOperation) {
      case WriteOperation.Edit:
        editPrivacyFields = getFieldsWithEditPrivacy(
          this.options.schema,
          this.options.fieldInfo,
        );
        break;

      case WriteOperation.Insert:
        editPrivacyFields = getFieldsForCreateAction(
          this.options.schema,
          this.options.fieldInfo,
        );
        break;
    }

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
    if (!getTransactionState() || isPreparingAction(this.options.builder)) {
      return this.validateImpl();
    }
    return this.prepareAction(() => this.validateImpl(), true);
  }

  private async prepareFields(): Promise<fieldsInfo> {
    assertActionPreparationAllowed();
    const requirement = this.options.action?.requiresTransactionScope?.();
    if (
      (requirement || this.options.action?.validateBeforeCommit) &&
      !getTransactionState()
    ) {
      throw new Error(
        "this action requires withTransactionScope; construct and save the action inside its callback",
      );
    }
    if (
      requirement === "serializable" &&
      getTransactionState()?.isolationLevel !== "serializable"
    ) {
      throw new Error(
        "this action requires a serializable withTransactionScope scope",
      );
    }
    assertLoaderTransaction(this.transaction);
    if (this.existingEnt) {
      assertEntTransaction(this.existingEnt);
    }
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

    const fields = await this.memoizedGetFields();
    // A completed action can expose fields and IDs from its saved snapshot.
    // Another save must not use those values as fresh preparation.
    if (getTransactionState()) {
      assertTransactionRead(this.fieldPreparationRead);
    }
    // A schema transform may replace the original mutation target.
    if (this.existingEnt) {
      assertEntTransaction(this.existingEnt);
    }
    return fields;
  }

  private async validateImpl(): Promise<Error[]> {
    const { schemaFields, editedData, userDefinedKeys, editPrivacyFields } =
      await this.prepareFields();
    if (this.transformedChangeset) {
      this.changesets.push(await this.transformedChangeset());
    }
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
      await awaitActionPreparations(promises);
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
    const [errs2, errs3] = await awaitActionPreparations([
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
    const groups: Trigger<TEnt, Builder<TEnt, TViewer>>[][] = [];
    let group: Trigger<TEnt, Builder<TEnt, TViewer>>[] = [];
    for (const trigger of triggers) {
      if (Array.isArray(trigger)) {
        if (group.length) {
          groups.push(group);
          group = [];
        }
        groups.push(trigger);
      } else {
        group.push(trigger);
      }
    }
    if (group.length) {
      groups.push(group);
    }

    for (const triggers of groups) {
      await awaitActionPreparations(
        triggers.map(async (trigger) => {
          let ret = await trigger.changeset(builder, action.getInput());
          if (Array.isArray(ret)) {
            ret = await awaitActionPreparations(ret);
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
    await awaitActionPreparations(
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
  ): Promise<{ data: Data; userDefinedKeys: Set<string> }> {
    let data: Data = {};
    let defaultData: Data = {};

    let input: Data = action?.getInput() || {};

    let updateInput = false;

    // transformations
    // if action transformations. always do it
    // if disable transformations set, don't do schema transform and just do the right thing
    // else apply schema tranformation if it exists
    let transformed: TransformedUpdateOperation<TEnt, TViewer> | null = null;
    const initialOperation = this.actualOperation;
    const initialEnt = this.existingEnt;

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
        for (const [k, field] of schemaFields) {
          const inputKey = this.getInputKey(k);
          const storageKey = this.getStorageKey(k);
          let inputVal = transformed.data[inputKey];
          if (inputVal === undefined) {
            inputVal = transformed.data[storageKey];
          }
          if (inputVal === undefined) {
            continue;
          }
          let dbVal = inputVal;
          if (field.format) {
            dbVal = field.format(inputVal, true);
          }
          data[this.getStorageKey(k)] = dbVal;
          if (!field.immutable) {
            this.defaultFieldsByTSName[this.getInputKey(k)] = inputVal;
          }
          // hmm do we need this?
          // TODO how to do this for local tests?
          // this.defaultFieldsByFieldName[k] = val;
        }
      }
      if (transformed.changeset) {
        if (this.transaction) {
          // Preserve transformed fields and defaults. Rebuild the child graph
          // for each preparation because standalone validation discards it.
          this.transformedChangeset = transformed.changeset.bind(transformed);
        } else {
          const changeset = await transformed.changeset();
          this.changesets.push(changeset);
        }
      }
      this.actualOperation = this.getWriteOpForSQLStamentOp(transformed.op);
      if (transformed.existingEnt) {
        // @ts-ignore
        this.existingEnt = transformed.existingEnt;
        // modify existing ent in builder. it's readonly in generated ents but doesn't apply here
        builder.existingEnt = transformed.existingEnt;
      }
    }
    if (
      this.fieldEdgeInputs.size > 0 &&
      (initialOperation !== this.actualOperation ||
        initialEnt !== this.existingEnt)
    ) {
      // Refresh inverse edges for the transformed operation and row before
      // applying defaults or running triggers.
      editedFields = await this.options.editedFields();
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
            if (isPromise(defaultValue)) {
              defaultValue = await defaultValue;
            }
          }
        }

        if (
          field.defaultValueOnEdit &&
          this.actualOperation === WriteOperation.Edit
        ) {
          defaultValue = field.defaultValueOnEdit(builder, input);
          if (isPromise(defaultValue)) {
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
        this.options.updateInput(
          this.defaultFieldsByTSName as TInput,
          this.actualOperation,
        );
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
        let valid = field.valid(value);
        if (isPromise(valid)) {
          valid = await valid;
        }
        if (!valid) {
          return invalidFieldError(fieldName, value);
        }
      }
      // keep track of dependencies to resolve
      this.dependencies.set(value.placeholderID, value);
      // keep track of fields to resolve
      this.fieldsToResolve.push(dbKey);
    } else {
      if (field.valid) {
        let valid = field.valid(value);
        if (isPromise(valid)) {
          valid = await valid;
        }
        if (!valid) {
          return invalidFieldError(fieldName, value);
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

    // If a trigger clears an input, the SQL write can still use its computed
    // default. Update inverse edges for defaults included in `data`; apply edit
    // defaults only when the edit has data to save.
    for (const [fieldName, field] of this.fieldEdgeInputs) {
      if (
        field.ids !== undefined ||
        data[this.getStorageKey(fieldName)] === undefined
      ) {
        continue;
      }
      const value = this.defaultFieldsByFieldName[fieldName];
      if (value === undefined) {
        continue;
      }
      this.__setFieldEdges(
        fieldName,
        value === null ? [] : Array.isArray(value) ? value : [value],
        field.edgeType,
        field.nodeType,
        {},
      );
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
      if (isValidationPreparation() && errors[0] instanceof Error) {
        validationFailures.add(errors[0]);
      }
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

  private snapshotPreparation(): () => void {
    const saved = {
      changesets: this.changesets,
      dependencies: this.dependencies,
      fieldsToResolve: this.fieldsToResolve,
      mainOp: this.mainOp,
      edges: this.edges,
      conditionalEdges: this.conditionalEdges,
      edgeSet: this.edgeSet,
    };
    const copyEdges = (edges: EdgeMap<TViewer>): EdgeMap<TViewer> =>
      new Map(
        [...edges].map(([type, operations]) => [
          type,
          new Map([...operations].map(([op, ids]) => [op, new Map(ids)])),
        ]),
      );
    this.changesets = [...saved.changesets];
    this.dependencies = new Map(saved.dependencies);
    this.fieldsToResolve = [...saved.fieldsToResolve];
    this.edges = copyEdges(saved.edges);
    this.conditionalEdges = copyEdges(saved.conditionalEdges);
    this.edgeSet = new Set(saved.edgeSet);
    return () => {
      Object.assign(this, saved);
    };
  }

  private async prepareAction<T>(
    prepare: () => Promise<T>,
    validationOnly = false,
  ): Promise<T> {
    const state = getTransactionState();
    if (state && this.preparationInProgress) {
      const error = new Error(
        "action preparation is already in progress; await validation before building or saving",
      );
      failTransaction(state, error);
      throw error;
    }
    if (state) {
      this.preparationInProgress = true;
    }
    // Standalone validation must discard each participant's child graph,
    // including retained children that a later save rebuilds.
    const probing = state && (validationOnly || isValidationPreparation());
    let restore: (() => void) | undefined;
    try {
      return await runInActionPreparation(
        this.options.builder,
        async () => {
          if (probing) {
            // Memoize defaults and transformed inputs, including inverse edges
            // set by updateInput. Snapshot those edges so validation preserves
            // them without applying them twice.
            await this.prepareFields();
            restore = this.snapshotPreparation();
          }
          return prepare();
        },
        validationOnly,
      );
    } catch (error) {
      if (
        state &&
        !(probing && error instanceof Error && validationFailures.has(error))
      ) {
        failTransaction(state, error);
      }
      throw error;
    } finally {
      if (state) {
        this.preparationInProgress = false;
      }
      restore?.();
    }
  }

  private async buildPlusChangeset(
    options?: ChangesetOptions,
  ): Promise<EntChangeset<TEnt>> {
    return this.prepareAction(() => {
      if (options) {
        this.dependencies.set(
          options.conditionalBuilder.placeholderID,
          options.conditionalBuilder,
        );
      }
      return this.buildChangeset(
        options?.conditionalBuilder ?? this.options.builder,
        options !== undefined,
      );
    });
  }

  private async buildChangeset(
    conditionalBuilder: Builder<TEnt, TViewer>,
    conditionalOverride: boolean,
  ): Promise<EntChangeset<TEnt>> {
    let ops: DataOperation<any, TViewer>[] = [];
    let processOps = true;
    if (
      this.options.action?.__failPrivacySilently &&
      this.options.action.__failPrivacySilently()
    ) {
      const res = await this.valid();
      if (!res) {
        processOps = false;
        const op = new NoOperation(this.options.builder, this.existingEnt, {
          tableName: this.options.tableName,
          key: this.options.key,
          fields: this.options.loaderOptions.fields,
        });
        this.mainOp = op;
        ops = [op];

        // we need an op that just returns the existing ent
      }
    } else {
      // validate everything first
      await this.validX();
    }

    if (processOps) {
      ops = [
        this.buildMainOp(conditionalOverride ? conditionalBuilder : undefined),
      ];

      await this.buildEdgeOps(ops, conditionalBuilder, conditionalOverride);
    }

    // TODO throw if we try and create a new changeset after previously creating one

    // TODO test actualOperation value
    // observers is fine since they're run after and we have the actualOperation value...

    if (getTransactionState()) {
      assertTransactionRead(this.fieldPreparationRead);
    }
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
    return this.buildPlusChangeset();
  }

  async buildWithOptions_BETA(
    options: ChangesetOptions,
  ): Promise<EntChangeset<TEnt>> {
    return this.buildPlusChangeset(options);
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

  private async loadResult<T extends TEnt | null>(
    load: () => Promise<T>,
  ): Promise<T> {
    const transaction = getTransactionState();
    let pending: Promise<T> | undefined;
    try {
      pending = trackValidationRead(load());
      if (transaction === this.transaction) {
        transaction?.pendingActions.add(pending);
      }
      const result = await pending;
      if (result) {
        recordActionResultTransaction(result, this.options.builder);
      }
      return result;
    } catch (error) {
      // Generated saves load their result after executeOperations returns.
      // Result failures must roll back the active owning scope even if caught.
      // Direct getter failures affect only the scope that created the result.
      if (transaction?.active && transaction === this.transaction) {
        failTransaction(transaction, error);
      }
      throw error;
    } finally {
      if (pending && transaction === this.transaction) {
        transaction?.pendingActions.delete(pending);
      }
    }
  }

  async editedEnt(): Promise<TEnt | null> {
    return this.loadResult(async () => {
      const row = await this.returnedRow();
      if (!row) {
        return null;
      }
      const viewer = await this.viewerForEntLoad(row);
      return applyPrivacyPolicyForActionResult(
        viewer,
        this.options.loaderOptions,
        row,
        this.options.builder,
      );
    });
  }

  async editedEntX(): Promise<TEnt> {
    return this.loadResult(async () => {
      const row = await this.returnedRow();
      if (!row) {
        throw new Error(`ent was not created`);
      }
      const viewer = await this.viewerForEntLoad(row);
      const ent = await applyPrivacyPolicyForActionResult(
        viewer,
        this.options.loaderOptions,
        row,
        this.options.builder,
      );

      if (!ent) {
        if (this.actualOperation == WriteOperation.Insert) {
          throw new Error(`was able to create ent but not load it`);
        } else {
          throw new Error(`was able to edit ent but not load it`);
        }
      }
      return ent;
    });
  }
}

function randomNum(): string {
  return Math.random().toString(10).substring(2);
}

// each changeset is required to have a unique placeholderID
// used in executor. if we end up creating multiple changesets from a builder, we need
// different placeholders
// in practice, only applies to Entchangeset::changesetFrom()
export class EntChangeset<
  TEnt extends Ent<TViewer>,
  TViewer extends Viewer = Viewer,
> implements Changeset
{
  private _executor: Executor | null;
  private transactionRead = getTransactionReadState();
  private validationOnly = isValidationPreparation();
  constructor(
    public viewer: Viewer,
    private builder: Builder<TEnt, TViewer>,
    public readonly placeholderID: ID,
    private conditionalOverride: boolean,
    public operations: DataOperation<any, TViewer>[],
    public dependencies?: Map<ID, Builder<Ent>>,
    public changesets?: Changeset[],
    private options?: OrchestratorOptions<TEnt, Data, TViewer>,
  ) {}

  static changesetFrom<
    TEnt extends Ent<TViewer>,
    TViewer extends Viewer = Viewer,
  >(builder: Builder<TEnt, TViewer, any>, ops: DataOperation<any, TViewer>[]) {
    return new EntChangeset(
      builder.viewer,
      builder,
      // need unique placeholderID different from the builder. see comment above EntChangeset
      `$ent.idPlaceholderID$ ${randomNum()}-${builder.ent.name}`,
      false,
      ops,
    );
  }

  static changesetFromQueries<
    TEnt extends Ent<TViewer>,
    TViewer extends Viewer = Viewer,
  >(
    builder: Builder<TEnt, TViewer, any>,
    queries: Array<string | parameterizedQueryOptions>,
  ) {
    return EntChangeset.changesetFrom(builder, [
      new RawQueryOperation(builder, queries),
    ]);
  }

  private static async changesetFromEdgeOp<
    TEnt extends Ent<TViewer>,
    TViewer extends Viewer = Viewer,
  >(
    builder: Builder<TEnt, TViewer, any>,
    op: EdgeOperation<TViewer>,
    edgeType: string,
  ) {
    const read = getTransactionReadState();
    const edgeData = await loadEdgeData(edgeType);
    assertTransactionRead(read);
    const ops: DataOperation<TEnt, TViewer>[] = [op];
    if (!edgeData) {
      throw new Error(`could not load edge data for '${edgeType}'`);
    }
    // similar logic in Orchestrator.buildEdgeOps
    // doesn't support conditional edges
    if (edgeData.symmetricEdge) {
      ops.push(op.symmetricEdge());
    }
    if (edgeData.inverseEdgeType) {
      ops.push(op.inverseEdge(edgeData));
    }
    return EntChangeset.changesetFrom(builder, ops);
  }

  static async changesetFromOutboundEdge<
    TEnt extends Ent<TViewer>,
    TViewer extends Viewer = Viewer,
  >(
    builder: Builder<TEnt, TViewer, any>,
    edgeType: string,
    id2: Builder<any, TViewer> | ID,
    nodeType: string,
    options?: AssocEdgeInputOptions,
  ) {
    return EntChangeset.changesetFromEdgeOp(
      builder,
      EdgeOperation.outboundEdge(builder, edgeType, id2, nodeType, options),
      edgeType,
    );
  }

  static async changesetFromInboundEdge<
    TEnt extends Ent<TViewer>,
    TViewer extends Viewer = Viewer,
  >(
    builder: Builder<TEnt, TViewer, any>,
    edgeType: string,
    id1: Builder<any, TViewer> | ID,
    nodeType: string,
    options?: AssocEdgeInputOptions,
  ) {
    return EntChangeset.changesetFromEdgeOp(
      builder,
      EdgeOperation.inboundEdge(builder, edgeType, id1, nodeType, options),
      edgeType,
    );
  }

  static changesetRemoveFromOutboundEdge<
    TEnt extends Ent<TViewer>,
    TViewer extends Viewer = Viewer,
  >(
    builder: Builder<TEnt, TViewer, any>,
    edgeType: string,
    id2: ID,
    options?: AssocEdgeInputOptions,
  ) {
    return EntChangeset.changesetFromEdgeOp(
      builder,
      EdgeOperation.removeOutboundEdge(builder, edgeType, id2, options),
      edgeType,
    );
  }

  static changesetRemoveFromInboundEdge<
    TEnt extends Ent<TViewer>,
    TViewer extends Viewer = Viewer,
  >(
    builder: Builder<TEnt, TViewer, any>,
    edgeType: string,
    id1: ID,
    options?: AssocEdgeInputOptions,
  ) {
    return EntChangeset.changesetFromEdgeOp(
      builder,
      EdgeOperation.removeInboundEdge(builder, edgeType, id1, options),
      edgeType,
    );
  }

  executor(): Executor {
    const transaction = getTransactionState();
    try {
      assertTransactionRead(this.transactionRead);
      if (this.validationOnly) {
        throw new Error(
          "changesets prepared by public validation cannot execute; rebuild them when saving",
        );
      }
      if (this._executor) {
        return this._executor;
      }

      if (!this.changesets?.length) {
        // Without child changesets, use a list executor. The parent complex
        // executor resolves any dependencies before running these operations.
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
    } catch (error) {
      if (transaction) {
        failTransaction(transaction, error);
      }
      throw error;
    }
  }
}
