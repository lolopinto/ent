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

export enum WriteOperation {
  Insert = "insert",
  Edit = "edit",
  Delete = "delete",
}

export interface Builder<T extends Ent> {
  existingEnt?: Ent;
  ent: EntConstructor<T>;
  placeholderID: ID;
  viewer: Viewer;
  build(): Promise<Changeset<T>>;
  operation: WriteOperation;
}

// interface DataOperation {
//   resolve?(executor: Executor); //throws?
// }

export interface Executor
  extends Iterable<DataOperation>,
    Iterator<DataOperation> {
  resolveValue(val: any): ID | null;
}

export interface Changeset<T extends Ent> {
  executor(): Executor;
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
  validate();
}

export interface Action<T extends Ent> {
  viewer: Viewer;
  changeset(): Promise<Changeset<T>>;
  //ent: EntConstructor<T>;
  builder: Builder<T>;
  privacyPolicy?: PrivacyPolicy; // todo make required?
  triggers?: Trigger<T>[];
  observers?: Observer[];
  validators?: Validator[];
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

  let row: {} | null = null;
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
        row = operation.returnedEntRow();
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

  if (row) {
    return new builder.ent(builder.viewer, row["id"], row);
  }
  return null;
}
