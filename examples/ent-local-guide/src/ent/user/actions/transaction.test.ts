import { randomUUID } from "crypto";
import { DB, IDViewer } from "@snowtop/ent";
import { withTransaction } from "@snowtop/ent/action";
import { User } from "src/ent";
import { CreateUserActionBase } from "../../generated/user/actions/create_user_action_base";
import DeleteUserAction from "./delete_user_action";
import EditUserAction from "./edit_user_action";
import FavoritePlace from "./favorite_place";

const dbTest = process.env.POSTGRES_TEST_DB ? test : test.skip;
const failure = new Error("generated helper setup failed");
class BrokenDelete extends DeleteUserAction {
  constructor(...args: ConstructorParameters<typeof DeleteUserAction>) {
    super(...args);
    throw failure;
  }
}
class BrokenFavorite extends FavoritePlace {
  addFavoritePlace(): this {
    throw failure;
  }
}

class GuardedCreate extends CreateUserActionBase {
  requiresTransaction() {
    return true;
  }
  async viewerForEntLoad() {
    return new IDViewer(await this.builder.getEntID());
  }
}

describe("generated save helpers in a scoped transaction", () => {
  let id: string;
  let missing: string;
  let viewer: IDViewer;
  let createdSlug: string;

  beforeEach(async () => {
    id = randomUUID();
    missing = randomUUID();
    viewer = new IDViewer(id);
    createdSlug = `transaction-created-${id}`;
    await DB.getInstance()
      .getPool()
      .query(
        "INSERT INTO users (id, created_at, updated_at, name, slug) VALUES ($1, now(), now(), 'Before', $2)",
        [id, `transaction-${id}`],
      );
  });
  afterEach(async () => {
    await DB.getInstance()
      .getPool()
      .query("DELETE FROM users WHERE id = $1 OR slug = $2", [id, createdSlug]);
  });
  const name = async () => (await User.loadX(viewer, id)).name;
  dbTest.each([
    ["delete load", () => DeleteUserAction.saveXFromID(viewer, missing)],
    [
      "edit load",
      () => EditUserAction.saveXFromID(viewer, missing, { name: "Never" }),
    ],
    ["edge load", () => FavoritePlace.saveXFromID(viewer, missing, id)],
    ["constructor", () => BrokenDelete.saveXFromID(viewer, id)],
    ["edge setup", () => BrokenFavorite.saveXFromID(viewer, id, missing)],
  ] as const)(
    "caught %s failure rolls back earlier writes",
    async (_label, save) => {
      let caught: unknown;
      let outer: unknown;
      try {
        await withTransaction(async (tx) => {
          await tx.exec(
            "UPDATE users SET name = 'Earlier write' WHERE id = $1",
            [id],
          );
          try {
            await save();
          } catch (error) {
            caught = error;
          }
        });
      } catch (error) {
        outer = error;
      }
      expect(caught).toBeInstanceOf(Error);
      expect(outer).toBe(caught);
      expect(await name()).toBe("Before");
    },
  );
  dbTest(
    "successful generated edit commits and returns the saved Ent",
    async () => {
      const result = await withTransaction(() =>
        EditUserAction.saveXFromID(viewer, id, { name: "After" }),
      );
      expect(result.name).toBe("After");
      expect(await name()).toBe("After");
    },
  );
  dbTest(
    "outside-scope helper failure does not undo earlier committed work",
    async () => {
      await DB.getInstance()
        .getPool()
        .query("UPDATE users SET name = 'Committed' WHERE id = $1", [id]);
      await expect(
        DeleteUserAction.saveXFromID(viewer, missing),
      ).rejects.toThrow();
      expect(await name()).toBe("Committed");
    },
  );
  dbTest(
    "generated guarded create exposes its ID during and after result loading",
    async () => {
      await withTransaction(async () => {
        const action = new GuardedCreate(viewer, {
          name: "Created",
          slug: createdSlug,
        });
        const result = await action.saveX();
        expect(await action.builder.getEntID()).toBe(result.id);
        expect(result.name).toBe("Created");
      });
    },
  );

  dbTest.each(["root", "child"] as const)(
    "generated %s without row writes returns fields updated by its graph",
    async (position) => {
      await withTransaction(async () => {
        const owner = await User.loadX(viewer, id);
        const noWrite = Object.assign(FavoritePlace.create(viewer, owner), {
          requiresTransaction: () => true,
          getTransactionResources: () => ["favorite-places"],
        });
        const writer = Object.assign(
          EditUserAction.create(viewer, owner, { name: "After" }),
          {
            requiresTransaction: () => true,
            getTransactionResources: () => ["user-name"],
          },
        );
        const parent = position === "root" ? noWrite : writer;
        const child = position === "root" ? writer : noWrite;
        parent.getTriggers = () => [{ changeset: () => child.changeset() }];
        const result = await parent.saveX();
        const refreshed =
          position === "root" ? result! : await noWrite.builder.editedEntX();
        expect(refreshed.name).toBe("After");
        await Object.assign(
          EditUserAction.create(viewer, refreshed, {
            name: `${refreshed.name} again`,
          }),
          {
            requiresTransaction: () => true,
          },
        ).saveX();
      });
      expect(await name()).toBe("After again");
    },
  );
});
