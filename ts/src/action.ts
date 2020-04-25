import {
  DataOperation,
  Ent,
  EntConstructor,
  Viewer,
  ID,
  applyPrivacyPolicyForEntX,
  applyPrivacyPolicyForEnt,
} from "./ent";
import { PrivacyPolicy } from "./privacy";
import DB from "./db";
import { LoggedOutViewer } from "./viewer";

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
}

export interface Executor<T extends Ent>
  extends Iterable<DataOperation<T>>,
    Iterator<DataOperation<T>> {
  // this returns a non-privacy checked "ent"
  // TODO are we sure we want Executor with type-T
  // and maybe only want resolveValue somehow??
  // Executor needs to work on multiple types at once eventually...
  resolveValue(val: any): T | null;
}

export interface Changeset<T extends Ent> {
  executor(): Executor<T>;
  viewer: Viewer;
  placeholderID: ID;
  ent: EntConstructor<T>;
  changesets?: Changeset<T>[];
  dependencies?: Map<ID, Builder<T>>;
}

export interface Trigger<T extends Ent> {
  changeset(): Changeset<T> | null; // TODO type
}

export interface Observer {
  observe();
}

export interface Validator {
  // can throw if it wants
  validate<T extends Ent>(builder: Builder<T>): Promise<void>;
  validate<T extends Ent>(builder: Builder<T>): void;
}

export interface Action<T extends Ent> {
  readonly viewer: Viewer;
  changeset(): Promise<Changeset<T>>;
  //ent: EntConstructor<T>;
  builder: Builder<T>;
  privacyPolicy?: PrivacyPolicy; // todo make required?
  triggers?: Trigger<T>[];
  observers?: Observer[];
  validators?: Validator[];

  valid(): Promise<boolean>;
  // throws if invalid
  validX(): Promise<void>;

  // if we have overloads we need to provide all which sucks
  // so maybe don't make the ones below required
  // save(): Promise<T | null>;
  // save(): Promise<void>;
  // saveX(): Promise<T>;
  // saveX(): Promise<T>;
}

export async function saveBuilder<T extends Ent>(
  builder: Builder<T>,
): Promise<T | null> {
  const ent = await saveBuilderImpl(builder, false);
  if (ent) {
    return ent;
    // TODO we need to apply privacy while loading
    // so we also need an API to get the raw object back e.g. for account creation
    // or a way to inject viewer for privacy purposes
    //    return applyPrivacyPolicyForEnt(builder.viewer, ent);
  }
  return null;
}

export async function saveBuilderX<T extends Ent>(
  builder: Builder<T>,
): Promise<T> {
  const ent = await saveBuilderImpl(builder, true);
  if (ent) {
    return ent;
    // TODO same as above re: viewer
    //    return applyPrivacyPolicyForEntX(builder.viewer, ent);
  }
  throw new Error("could not save ent for builder");
}

// this is used by delete builders which want exceptions but don't want to load the ent
export async function saveBuilderXNoEnt<T extends Ent>(
  builder: Builder<T>,
): Promise<void> {
  await saveBuilderImpl(builder, true);
}

async function saveBuilderImpl<T extends Ent>(
  builder: Builder<T>,
  throwErr: boolean,
): Promise<T | null> {
  const changeset = await builder.build();
  const executor = changeset.executor();

  const client = await DB.getInstance().getNewClient();

  let viewer = new LoggedOutViewer();
  let ent: T | null = null;
  try {
    await client.query("BEGIN");
    for (const operation of executor) {
      // resolve any placeholders before writes
      if (operation.resolve) {
        operation.resolve(executor);
      }

      await operation.performWrite(client);
      if (operation.returnedEntRow) {
        // we need a way to eventually know primary vs not once we can stack these
        // things with triggers etc
        ent = operation.returnedEntRow(viewer);
      }
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    // rethrow the exception to be caught
    if (throwErr) {
      throw e;
    } else {
      console.error(e);
    }
  } finally {
    client.release();
  }

  return ent;
}
