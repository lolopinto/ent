import { DataOperation, Ent, EntConstructor, Viewer, ID } from "../core/ent";
import { PrivacyPolicy } from "../core/privacy";
import DB from "../core/db";

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

export interface Executor<T extends Ent>
  extends Iterable<DataOperation>,
    Iterator<DataOperation> {
  // this returns a non-privacy checked "ent"
  // TODO are we sure we want Executor with type-T
  // and maybe only want resolveValue somehow??
  // Executor needs to work on multiple types at once eventually...
  resolveValue(val: any): T | null;
  executeObservers?(): Promise<void>;
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
  // TODO: way in the future. detect any writes happening in changesets and optionally throw if configured to do so
  // can throw if it wants. not expected to throw tho.
  changeset(
    builder: Builder<T>,
  ): // hmm Promise<void> is not yet an option...
  void | Promise<Changeset<T> | Changeset<T>[]>;
}

export interface Observer<T extends Ent> {
  observe(builder: Builder<T>): void | Promise<void>;
}

export interface Validator<T extends Ent> {
  // can throw if it wants
  validate(builder: Builder<T>): Promise<void> | void;
}

export interface Action<T extends Ent> {
  readonly viewer: Viewer;
  changeset(): Promise<Changeset<T>>;
  builder: Builder<T>;
  privacyPolicy?: PrivacyPolicy; // todo make required?
  triggers?: Trigger<T>[];
  observers?: Observer<T>[];
  validators?: Validator<T>[];

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
    if (throwErr) {
      throw e;
    } else {
      // expected...
      return;
    }
  }
  const executor = changeset!.executor();

  const client = await DB.getInstance().getNewClient();

  let error = false;
  try {
    await client.query("BEGIN");
    for (const operation of executor) {
      // resolve any placeholders before writes
      if (operation.resolve) {
        operation.resolve(executor);
      }

      await operation.performWrite(client, builder.viewer.context);
    }
    await client.query("COMMIT");
  } catch (e) {
    error = true;
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

  if (!error && executor.executeObservers) {
    await executor.executeObservers();
  }
}
