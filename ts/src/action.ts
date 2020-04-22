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
  // also need the builder to pass to things...
  // we don't need the triggers here because triggers are run to create the changeset
  // do we need the validators tho?
  // if we run the field based validators, we can run the normal validators?
  // we don't need the validators or triggers because they're used to build the changeset
  //  builder: Builder<T>;
  //  observers?// still need builder to pass to observer...
}

export interface Trigger<T extends Ent> {
  // can throw if it wants. not expected to throw tho.
  changeset(builder: Builder<T>): void | Promise<Changeset<T>>;
}

export interface Observer {
  observe();
}

export interface Validator<T extends Ent> {
  // can throw if it wants
  validate(builder: Builder<T>): Promise<void> | void;
}

export interface Action<T extends Ent> {
  readonly viewer: Viewer;
  changeset(): Promise<Changeset<T>>;
  //ent: EntConstructor<T>;
  builder: Builder<T>;
  privacyPolicy?: PrivacyPolicy; // todo make required?
  triggers?: Trigger<T>[];
  observers?: Observer[];
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
  const changeset = await builder.build();
  const executor = changeset.executor();

  const client = await DB.getInstance().getNewClient();

  let viewer = new LoggedOutViewer();
  try {
    await client.query("BEGIN");
    for (const operation of executor) {
      // resolve any placeholders before writes
      if (operation.resolve) {
        operation.resolve(executor);
      }

      await operation.performWrite(client);
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
}
