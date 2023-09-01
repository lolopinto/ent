import { Data, Ent, Viewer } from "../core/base";
import { FakeUser } from "./fake_data";
import { EdgeQuery } from "../core/query";
import { MockLogs } from "./mock_log";

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
    console.debug("first", pageLength, cursor);
    const newEdges = await query.first(pageLength, cursor).queryEdges();

    const pagination = query.paginationInfo().get(user.id);
    if (hasEdge) {
      expect(newEdges[0], `${i}`).toStrictEqual(edges[i]);
      expect(newEdges.length, `${i}`).toBe(
        edges.length - i >= pageLength ? pageLength : edges.length - i,
      );
      // verify items are the same in order
      expect(newEdges, `${i}`).toStrictEqual(
        edges.slice(i, i + newEdges.length),
      );
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
    // console.debug(query.getCursor(edge));
    return query.getCursor(edge);
  }
  return { verify, getCursor };
}

// TODO copy from shared_test

export function getWhereClause(query: any) {
  const idx = (query.query as string).indexOf("WHERE");
  if (idx !== -1) {
    return query.query.substr(idx + 6);
  }
  return null;
}

// TODO...

// function getVerifyBeforeEachCursor(
//   edges: TData[],
//   pageLength: number,
//   user: FakeUser,
// ) {
//   let query: EdgeQuery<FakeUser, FakeContact, Data>;

//   async function verify(
//     i: number,
//     hasEdge: boolean,
//     hasPreviousPage: boolean,
//     cursor?: string,
//   ) {
//     ml.clear();

//     query = opts.newQuery(getViewer(), user);
//     const newEdges = await query.last(pageLength, cursor).queryEdges();

//     const pagination = query.paginationInfo().get(user.id);
//     if (hasEdge) {
//       expect(newEdges.length, `${i}`).toBe(
//         i >= pageLength ? pageLength : i + 1,
//       );
//       expect(newEdges[0], `${i}`).toStrictEqual(edges[i]);
//     } else {
//       expect(newEdges.length, `${i}`).toBe(0);
//     }

//     if (hasPreviousPage) {
//       expect(pagination?.hasPreviousPage, `${i}`).toBe(true);
//       expect(pagination?.hasNextPage, `${i}`).toBe(false);
//     } else {
//       expect(pagination?.hasPreviousPage, `${i}`).toBe(undefined);
//       expect(pagination?.hasNextPage, `${i}`).toBe(undefined);
//     }
//     const orderby = reverseOrderBy(opts.orderby);
//     if (cursor) {
//       verifyLastBeforeCursorQuery(query!, {
//         length: 1,
//         limit: pageLength,
//         orderby,
//       });
//     } else {
//       verifyQuery(query!, {
//         orderby,
//         limit: pageLength,
//       });
//     }
//   }
//   function getCursor(edge: TData) {
//     return query.getCursor(edge);
//   }
//   return { verify, getCursor };
// }
