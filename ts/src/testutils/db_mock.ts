import { v4 as uuidv4 } from "uuid";
import { Pool, PoolClient } from "pg";
import { mocked } from "ts-jest/utils";
import { ID, Ent, AssocEdgeData } from "./../ent";

const eventEmitter = {
  on: jest.fn(),
  addListener: jest.fn(),
  removeListener: jest.fn(),
  once: jest.fn(),
  off: jest.fn(),
  removeAllListeners: jest.fn(),
  setMaxListeners: jest.fn(),
  getMaxListeners: jest.fn(),
  listeners: jest.fn(),
  rawListeners: jest.fn(),
  emit: jest.fn(),
  listenerCount: jest.fn(),
  prependListener: jest.fn(),
  prependOnceListener: jest.fn(),
  eventNames: jest.fn(),
};

export interface queryOptions {
  query: string;
  values?: any[];
}

export class QueryRecorder {
  private static queries: queryOptions[] = [];
  private static ids: ID[] = [];

  static recordQuery(query: string, values: any[]) {
    //  console.log(query, values);

    QueryRecorder.queries.push({
      query: query,
      values: values,
    });
    // mock all possible (known) results here...
    let ret = {};
    let rowCount = 0;

    // we parsing sql now??
    // slowing building sqlshim?
    // make it so that we return the values entered back when mocking the db
    if (/RETURNING \*$/.test(query)) {
      let execArray = /INSERT INTO \w+ \((.+)\) VALUES \((.+)\)/.exec(query);
      if (execArray) {
        let keys = execArray[1].split(", ");
        if (keys.length === values.length) {
          for (let i = 0; i < keys.length; i++) {
            let key = keys[i];
            let value = values[i];
            ret[key] = value;
          }
          rowCount++;
        }
      }
    }
    return {
      rows: [ret],
      rowCount: rowCount,
      oid: 0,
      fields: [],
      command: "",
    };
  }

  static newID(): ID {
    let id = uuidv4();
    QueryRecorder.ids.push(id);
    return id;
  }

  static getCurrentIDs(): ID[] {
    return QueryRecorder.ids;
  }

  static clear() {
    QueryRecorder.queries = [];
    QueryRecorder.ids = [];
  }

  static getCurrentQueries(): queryOptions[] {
    return QueryRecorder.queries;
  }

  static validateQueriesInTx(expected: queryOptions[], ent: Ent | null) {
    expected.unshift({ query: "BEGIN" });
    expected.push({ query: "COMMIT" });
    this.validateQueryOrder(expected, ent);
  }

  static validateFailedQueriesInTx(expected: queryOptions[], ent: Ent | null) {
    expected.unshift({ query: "BEGIN" });
    expected.push({ query: "ROLLBACK" });
    this.validateQueryOrder(expected, ent);
  }

  static validateQueryOrder(expected: queryOptions[], ent: Ent | null) {
    let queries = QueryRecorder.queries;
    expect(queries.length).toBe(expected.length);

    for (let i = 0; i < expected.length; i++) {
      expect(queries[i].query, `${i}th query`).toBe(expected[i].query);

      if (expected[i].values === undefined) {
        expect(queries[i].values, `${i}th query`).toBe(undefined);
      } else {
        let expectedVals = expected[i].values!;
        let actualVals = queries[i].values!;
        expect(actualVals.length, `${i}th query`).toBe(expectedVals.length);

        for (let j = 0; j < expectedVals.length; j++) {
          let expectedVal = expectedVals[j];
          let actualVal = actualVals[j];

          if (expectedVal === "{id}") {
            expectedVal = ent?.id;
          }
          expect(actualVal, `${i}th query`).toStrictEqual(expectedVal);
        }
      }
    }
  }

  static mockPool(pool: typeof Pool) {
    const mockedPool = mocked(pool, true);
    mockedPool.mockImplementation(
      (): Pool => {
        return {
          totalCount: 1,
          idleCount: 1,
          waitingCount: 1,
          connect: async (): Promise<PoolClient> => {
            return {
              connect: jest.fn(),
              release: jest.fn(),
              query: jest
                .fn()
                .mockImplementation((query: string, values: any[]) => {
                  return QueryRecorder.recordQuery(query, values);
                }),
              copyFrom: jest.fn(),
              copyTo: jest.fn(),
              pauseDrain: jest.fn(),
              resumeDrain: jest.fn(),
              escapeIdentifier: jest.fn(),
              escapeLiteral: jest.fn(),

              // EventEmitter
              ...eventEmitter,
            };
          },
          end: jest.fn(),
          query: jest.fn(),

          // EventEmitter
          ...eventEmitter,
        };
      },
    );
  }

  // mock loadEdgeDatas and return a simple non-symmetric|non-inverse edge
  // not sure if this is the best way but it's the only way I got
  // long discussion about issues: https://github.com/facebook/jest/issues/936

  // TODO type correctly
  static mockLoadEdgeDatas(ent: any) {
    jest.spyOn(ent, "loadEdgeDatas").mockImplementation(
      async (...edgeTypes: string[]): Promise<Map<string, AssocEdgeData>> => {
        if (!edgeTypes.length) {
          return new Map();
        }
        return new Map(
          edgeTypes.map((edgeType) => [
            edgeType,
            new AssocEdgeData({
              edge_table: "assoc_edge_config",
              symmetric_edge: false,
              inverse_edge_type: null,
              edge_type: edgeType,
              edge_name: "name",
            }),
          ]),
        );
      },
    );
  }
}

// TODO
process.env.DB_CONNECTION_STRING = "ss";
