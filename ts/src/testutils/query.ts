import { Data, Ent, Viewer } from "../core/base.js";
import { FakeUser } from "./fake_data/index.js";
import { EdgeQuery } from "../core/query/index.js";
import { MockLogs } from "./mock_log.js";

export function getVerifyAfterEachCursorGeneric<
  TSource extends Ent<Viewer>,
  TDest extends Ent<Viewer>,
  TData extends Data,
>(
  edges: TData[],
  pageLength: number,
  user: FakeUser,
  getQuery: () => EdgeQuery<TSource, TDest, TData>,
  ml: MockLogs,
  verifyQuery?: (
    query: EdgeQuery<TSource, TDest, TData>,
    cursor: string | undefined,
  ) => void,
) {
  let query: EdgeQuery<TSource, TDest, TData>;

  async function verify(
    i: number,
    hasEdge: boolean,
    hasNextPage: boolean | undefined,
    cursor?: string,
  ) {
    ml.clear();
    query = getQuery();
    const newEdges = await query.first(pageLength, cursor).queryEdges();

    const pagination = query.paginationInfo().get(user.id);
    if (hasEdge) {
      expect(newEdges[0], `${i}`).toEqual(edges[i]);
      expect(newEdges.length, `${i}`).toBe(
        edges.length - i >= pageLength ? pageLength : edges.length - i,
      );
      // verify items are the same in order
      expect(newEdges, `${i}`).toEqual(edges.slice(i, i + newEdges.length));
    } else {
      expect(newEdges.length, `${i}`).toBe(0);
    }

    if (hasNextPage) {
      expect(pagination?.hasNextPage, `${i}`).toBe(true);
      expect(pagination?.hasPreviousPage, `${i}`).toBe(false);
    } else {
      expect(pagination?.hasPreviousPage, `${i}`).toBeFalsy();
      expect(pagination?.hasNextPage, `${i}`).toBeFalsy();
    }

    if (verifyQuery) {
      verifyQuery(query!, cursor);
    }
  }

  function getCursor(edge: TData) {
    return query.getCursor(edge);
  }
  return { verify, getCursor };
}

export function getWhereClause(query: any) {
  const idx = (query.query as string).indexOf("WHERE");
  if (idx !== -1) {
    return query.query.substr(idx + 6);
  }
  return null;
}
