import { Dialect } from "@snowtop/ent/core/db";
import { DB, IDViewer, withTransaction } from "@snowtop/ent";
import { getBuilderSchemaFromFields } from "@snowtop/ent/testutils/builder";
import {
  getSchemaTable,
  setupPostgres,
} from "@snowtop/ent/testutils/db/temp_db";
import { User } from "src/ent";
import UserSchema from "src/schema/user_schema";
import { CreateUserActionBase } from "../../generated/user/actions/create_user_action_base";
import DeleteUserAction from "./delete_user_action";
import EditUserAction from "./edit_user_action";
import FavoritePlace from "./favorite_place";

const id = "e408025d-bffd-4c09-8219-727d2f4a1b83";
const missing = "80aed407-1c09-4453-9457-ff0a029c61f8";
const viewer = new IDViewer(id);
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
  setupPostgres(() => [
    getSchemaTable(
      getBuilderSchemaFromFields(UserSchema.fields, User),
      Dialect.Postgres,
    ),
  ]);
  beforeEach(async () => {
    await DB.getInstance()
      .getPool()
      .query(
        "INSERT INTO users (id, created_at, updated_at, name, slug) VALUES ($1, now(), now(), 'Before', 'scoped-user')",
        [id],
      );
  });
  const name = async () => (await User.loadX(viewer, id)).name;
  test.each([
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
  test("successful generated edit commits and returns the saved Ent", async () => {
    const result = await withTransaction(() =>
      EditUserAction.saveXFromID(viewer, id, { name: "After" }),
    );
    expect(result.name).toBe("After");
    expect(await name()).toBe("After");
  });
  test("outside-scope helper failure does not undo earlier committed work", async () => {
    await DB.getInstance()
      .getPool()
      .query("UPDATE users SET name = 'Committed' WHERE id = $1", [id]);
    await expect(
      DeleteUserAction.saveXFromID(viewer, missing),
    ).rejects.toThrow();
    expect(await name()).toBe("Committed");
  });
  test("generated guarded create exposes its ID during and after result loading", async () => {
    await withTransaction(async () => {
      const action = new GuardedCreate(viewer, {
        name: "Created",
        slug: "created-in-scope",
      });
      const result = await action.saveX();
      expect(await action.builder.getEntID()).toBe(result.id);
      expect(result.name).toBe("Created");
    });
  });
});
