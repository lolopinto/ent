import { SQLStatementOperation } from "@snowtop/ent";
import { DeletedAtPattern, GlobalDeletedEdge } from "./soft_delete";

test("deleted at pattern turns deletes into updates", () => {
  const pattern = new DeletedAtPattern();

  expect(
    pattern.transformWrite({ op: SQLStatementOperation.Update } as any),
  ).toBeNull();
  expect(
    pattern.transformWrite({ op: SQLStatementOperation.Delete } as any),
  ).toMatchObject({
    op: SQLStatementOperation.Update,
    data: {
      deleted_at: expect.any(Date),
    },
  });
});

test("global deleted edge turns deletes into updates", () => {
  expect(
    GlobalDeletedEdge.transformEdgeWrite({
      op: SQLStatementOperation.Update,
    } as any),
  ).toBeNull();
  expect(
    GlobalDeletedEdge.transformEdgeWrite({
      op: SQLStatementOperation.Delete,
    } as any),
  ).toMatchObject({
    op: SQLStatementOperation.Update,
    data: {
      deleted_at: expect.any(Date),
    },
  });
});
