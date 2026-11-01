import { Data, EdgeQueryableDataOptions, Ent, ID } from "../base";
import { Eq } from "../clause";
import { LoggedOutViewer } from "../viewer";
import { AnyEnt } from "../../testutils/builder";
import { GraphQLEdgeConnection } from "../../graphql/query/edge_connection";
import { BaseEdgeQuery, IDInfo } from "./query";
import { CustomClauseQuery } from "./custom_clause_query";

const viewer = new LoggedOutViewer();
const rows = [{ id: "row-1" }, { id: "row-2" }, { id: "row-3" }];

class GroupedQuery extends BaseEdgeQuery<Ent, AnyEnt, Data> {
  constructor() {
    super(viewer, {
      cursorCol: "id",
      orderby: [{ column: "id", direction: "ASC" }],
    });
  }
  async sourceEnt(_id: ID) {
    return null;
  }
  getTableName() {
    return "unused";
  }
  async queryRawCount() {
    return rows.length;
  }
  async queryAllRawCount() {
    return new Map([["parent", rows.length]]);
  }
  dataToID(row: Data) {
    return row.id;
  }
  protected async loadRawIDs(add: (src: ID | Ent) => void) {
    add("parent");
  }
  protected async loadRawData(
    infos: IDInfo[],
    _options: EdgeQueryableDataOptions,
  ) {
    for (const info of infos) {
      this.edges.set(info.id, info.invalidated ? [] : rows);
    }
  }
  protected async loadEntsFromEdges(_id: ID, data: Data[]) {
    return data.map((row) => new AnyEnt(viewer, row));
  }
  getCursor(row: Data) {
    return super.getCursor(row).replace(/=+$/, "");
  }
}

class SingleQuery extends CustomClauseQuery<AnyEnt> {
  constructor() {
    super(viewer, {
      name: "cursor-override",
      clause: Eq("id", "unused"),
      loadEntOptions: AnyEnt.loaderOptions("unused", ["id"]),
    });
  }
  protected async loadRawData(_options: EdgeQueryableDataOptions) {
    return rows;
  }
  getCursor(row: Data) {
    return super.getCursor(row).replace(/=+$/, "");
  }
}

describe.each([GroupedQuery, SingleQuery])("%p cursor overrides", (Query) => {
  test.each([
    "first",
    "last",
  ] as const)("%s page info matches connection edge cursors", async (direction) => {
    const query = new Query()[direction](2);
    const connection = new GraphQLEdgeConnection(viewer, async () => query);
    const [edges, page] = await Promise.all([
      connection.queryEdges(),
      connection.queryPageInfo(),
    ]);
    expect(edges).toHaveLength(2);
    expect(page.hasNextPage).toBe(direction === "first");
    expect(page.hasPreviousPage).toBe(direction === "last");
    expect(page.startCursor).toBe(edges[0].cursor);
    expect(page.endCursor).toBe(edges[1].cursor);
    expect(page.startCursor).not.toMatch(/=$/);
    expect(page.endCursor).not.toMatch(/=$/);
    expect([...query.paginationInfo().values()]).toEqual([page]);
  });
});
