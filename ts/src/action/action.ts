import {
  Ent,
  EntConstructor,
  Viewer,
  ID,
  Data,
  PrivacyPolicy,
  Context,
} from "../core/base";
import {
  DataOperation,
  loadEdgeForID2,
  AssocEdge,
  AssocEdgeInputOptions,
} from "../core/ent";
import { Queryer } from "../core/db";
import { log } from "../core/logger";

export enum WriteOperation {
  Insert = "insert",
  Edit = "edit",
  Delete = "delete",
}

export interface Builder<T extends Ent> {
  existingEnt?: Ent;
  ent: EntConstructor<T>;
  placeholderID: ID;
  readonly viewer: Viewer;
  build(): Promise<Changeset<T>>;
  operation: WriteOperation;
  editedEnt?(): Promise<T | null>;
}

export interface Executor
  extends Iterable<DataOperation>,
    Iterator<DataOperation> {
  placeholderID: ID;
  // this returns a non-privacy checked "ent"
  resolveValue(val: any): Ent | null;
  execute(): Promise<void>;

  // these 3 are to help chained/contained executors
  preFetch?(queryer: Queryer, context?: Context): Promise<void>;
  postFetch?(queryer: Queryer, context?: Context): Promise<void>;
  executeObservers?(): Promise<void>;
}

export interface Changeset<T extends Ent> {
  executor(): Executor;
  viewer: Viewer;
  placeholderID: ID;
  ent: EntConstructor<T>;
  changesets?: Changeset<Ent>[];
  dependencies?: Map<ID, Builder<T>>;
}

export type TriggerReturn =
  | void
  | Promise<Changeset<Ent> | void | (Changeset<Ent> | void)[]>
  | Promise<Changeset<Ent>>[];

export interface Trigger<T extends Ent> {
  // TODO: way in the future. detect any writes happening in changesets and optionally throw if configured to do so
  // can throw if it wants. not expected to throw tho.
  // input passed in here !== builder.getInput()
  // builder.getInput() can have other default fields
  changeset(builder: Builder<T>, input: Data): TriggerReturn;
}

export interface Observer<T extends Ent> {
  // input passed in here !== builder.getInput()
  // builder.getInput() can have other default fields
  observe(builder: Builder<T>, input: Data): void | Promise<void>;
}

export interface Validator<T extends Ent> {
  // can throw if it wants
  // input passed in here !== builder.getInput()
  // builder.getInput() can have other default fields
  validate(builder: Builder<T>, input: Data): Promise<void> | void;
}

export interface Action<T extends Ent> {
  readonly viewer: Viewer;
  changeset(): Promise<Changeset<T>>;
  builder: Builder<T>;
  getPrivacyPolicy(): PrivacyPolicy;
  triggers?: Trigger<T>[];
  observers?: Observer<T>[];
  validators?: Validator<T>[];
  getInput(): Data; // this input is passed to Triggers, Observers, Validators

  valid(): Promise<boolean>;
  // throws if invalid
  validX(): Promise<void>;

  // this is used to load the ent after the action
  // you can imagine this being overwritten for a create user or create account
  // action to load the just-created user after the fact
  viewerForEntLoad?(data: Data): Viewer | Promise<Viewer>;

  // if we have overloads we need to provide all which sucks
  // so maybe don't make the ones below required
  // save(): Promise<T | null>;
  // save(): Promise<void>;
  // saveX(): Promise<T>;
  // saveX(): Promise<T>;
}

export async function saveBuilder<T extends Ent>(
  builder: Builder<T>,
): Promise<void> {
  await saveBuilderImpl(builder, false);
}

export async function saveBuilderX<T extends Ent>(
  builder: Builder<T>,
): Promise<void> {
  await saveBuilderImpl(builder, true);
}

async function saveBuilderImpl<T extends Ent>(
  builder: Builder<T>,
  throwErr: boolean,
): Promise<void> {
  let changeset: Changeset<T>;
  try {
    changeset = await builder.build();
  } catch (e) {
    log("error", e);
    if (throwErr) {
      throw e;
    } else {
      // expected...
      return;
    }
  }
  const executor = changeset!.executor();
  if (throwErr) {
    return executor.execute();
  } else {
    try {
      return executor.execute();
    } catch (e) {
      // it's already caught and logged upstream
    }
  }
}

// Orchestrator in orchestrator.ts in generated Builders
// we indicate the API we expect here. Not typing it to Orchestrator class in Orchestrator.ts
// for flexibility
interface Orchestrator {
  addOutboundEdge<T2 extends Ent>(
    id2: ID | Builder<T2>,
    edgeType: string,
    nodeType: string,
    options?: AssocEdgeInputOptions,
  ): void;
  removeOutboundEdge(id2: ID, edgeType: string): void;
  viewer: Viewer;
}

async function modifyEdgeSet<T extends string>(
  orchestrator: Orchestrator,
  id1: ID,
  id2: ID,
  inputEnumValue: string,
  enumValue: string,
  edgeType: T,
  nodeType: string,
) {
  let edge = await loadEdgeForID2({
    id1: id1,
    id2: id2,
    edgeType: edgeType,
    ctr: AssocEdge,
    context: orchestrator.viewer.context,
  });
  // always add the edge because the data field may be getting overwritten later on
  // and we need to give that operation a chance to succeed
  // TODO: can save a write here by checking in EdgeOperation and not doing this write if nothing
  // has changed.
  if (inputEnumValue === enumValue) {
    orchestrator.addOutboundEdge(id2, edgeType, nodeType);
  }
  if (edge) {
    if (enumValue !== inputEnumValue) {
      orchestrator.removeOutboundEdge(id2, edgeType);
    }
  }
}

// This sets one edge in a group
// used for assoc groups where setting the value of one edge in the group
// unsets the other
// e.g. 3 states for event rsvp: attending, maybe, declined. user can't be rsvped as more than one at a time so this helps you
// so that setting an rsvp status for one clears the others (if set)
// or for friendship status: incoming_friend_request, outgoing_friend_request, are_friends
// accepting a friend request should clear an incoming or outgoing friend request
// @args
// orchestrator: see interface
// inputEnumValue: the value of the enum. should be one of the keys of m
// id1: source ID in Orchestrator. We take this as extra param because we need it to check if edge exists
// id2: target id
// nodeType: nodeType of ent in question
// m: Map<enumType, to EdgeType to check>
export async function setEdgeTypeInGroup<T extends string>(
  orchestrator: Orchestrator,
  inputEnumValue: string,
  id1: ID,
  id2: ID,
  nodeType: string,
  m: Map<T, string>,
) {
  let promises: Promise<void>[] = [];
  for (const [k, v] of m) {
    promises.push(
      modifyEdgeSet(orchestrator, id1, id2, inputEnumValue, k, v, nodeType),
    );
  }
  await Promise.all(promises);
}
