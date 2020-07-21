import { v4 as uuidv4 } from "uuid";
import { Pool, PoolClient, Query } from "pg";
import { mocked } from "ts-jest/utils";
import { ID, Ent, AssocEdgeData } from "./../ent";
import { Clause } from "./../query";

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
  qs?: internalQueryStructure | null;
}

export interface mockOptions {
  tableName: string;
  //  columns?: string[];
  clause: Clause;
  result: (values: any[]) => {};
}

export enum queryType {
  SELECT,
  INSERT,
  UPDATE,
  BEGIN,
  COMMIT,
  ROLLBACK,
}

export interface queryStructure {
  tableName?: string;
  type: queryType;
  //  columns?: string[];
  values?: any[];
}

interface internalQueryStructure extends queryStructure {
  query: string;
  colummns?: string[];
  whereClause?: string;
  suffix?: string;
  setClause?: string;
}

export class QueryRecorder {
  private static queries: queryOptions[] = [];
  private static ids: ID[] = [];
  private static mockResults: mockOptions[] = [];

  static mockResult(options: mockOptions) {
    this.mockResults.push(options);
  }

  // TODO incorporate values, tableName etc...
  private static findMockResult(qs: internalQueryStructure, values) {
    for (let result of this.mockResults) {
      if (
        result.tableName === qs.tableName &&
        result.clause.clause(1) === qs.whereClause
      ) {
        // correct table and clause
        // for now we don't care about columns...
        // we may later.
        return result.result(values);
      }
    }
  }

  private static getQueryStructure(query): internalQueryStructure | null {
    // we parsing sql now??
    // slowing building sqlshim?
    // make it so that we return the values entered back when mocking the db

    if (/^INSERT/.test(query)) {
      let execArray = /INSERT INTO (.+) \((.+)\) VALUES \((.+)\) (.+)?/.exec(
        query,
      );
      if (execArray) {
        return {
          tableName: execArray[1],
          colummns: execArray[2].split(", "),
          type: queryType.INSERT,
          query: execArray[0],
          suffix: execArray[4],
        };
      }
      return null;
    }

    if (/^SELECT/.test(query)) {
      let execArray = /^SELECT (.+) FROM (.+) WHERE (.+)?/.exec(query);
      if (execArray) {
        return {
          tableName: execArray[2],
          whereClause: execArray[3],
          type: queryType.SELECT,
          query: execArray[0],
          colummns: execArray[1].split(", "),
        };
      }
    }

    if (/^UPDATE/.test(query)) {
      // regex can't do returning
      let execArray = /^UPDATE (.+) SET (.+) WHERE (.+) /.exec(query);
      if (execArray) {
        return {
          tableName: execArray[1],
          // not completely accurate
          whereClause: execArray[3],
          type: queryType.UPDATE,
          query: execArray[0],
          setClause: execArray[2],
          //          colummns: execArray[1].split(", "),
        };
      }
    }
    return null;
  }

  static recordQuery(query: string, values: any[]) {
    //    console.log(query, values);

    // mock all possible (known) results here...
    let ret = {};
    let rowCount = 0;

    let qs = QueryRecorder.getQueryStructure(query);
    QueryRecorder.queries.push({
      query: query,
      values: values,
      qs: qs,
    });

    if (qs && qs.type === queryType.INSERT) {
      if (
        qs?.colummns?.length === values.length &&
        qs.suffix &&
        /^RETURNING/.test(qs.suffix)
      ) {
        for (let i = 0; i < qs.colummns.length; i++) {
          let key = qs.colummns[i];
          let value = values[i];
          ret[key] = value;
        }
        rowCount++;
      }
    }

    if (qs && qs.type === queryType.SELECT) {
      let row = QueryRecorder.findMockResult(qs, values);
      if (row) {
        ret = row;
        rowCount++;
      }
    }

    if (qs && qs.type === queryType.UPDATE) {
      if (qs.whereClause && /RETURNING/.test(qs.whereClause!)) {
        let parts = qs.setClause!.split(", ");
        for (let i = 0; i < parts.length; i++) {
          let part = parts[i];
          ret[part.split(" = ")[0]] = values[i];
        }

        rowCount++;
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
    QueryRecorder.mockResults = [];
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

  static validateQueryStructuresInTx(expected: queryStructure[]) {
    expected.unshift({ type: queryType.BEGIN });
    expected.push({ type: queryType.COMMIT });
    // we don't care about reads so skipping them for now.
    this.validateQueryStructures(expected, true);
  }

  static validateQueryStructures(
    expected: queryStructure[],
    skipSelect: boolean,
  ) {
    let queries = QueryRecorder.queries;
    if (skipSelect) {
      queries = queries.filter((query) => query.qs?.type !== queryType.SELECT);
    }
    expect(queries.length).toBe(expected.length);

    for (let i = 0; i < expected.length; i++) {
      let expectedStructure = expected[i];
      let query = queries[i];
      switch (expectedStructure.type) {
        case queryType.BEGIN:
          expect(query.query).toBe("BEGIN");
          expect(query.values).toBe(undefined);
          break;
        case queryType.ROLLBACK:
          expect(query.query).toBe("ROLLBACK");
          expect(query.values).toBe(undefined);
          break;
        case queryType.COMMIT:
          expect(query.query).toBe("COMMIT");
          expect(query.values).toBe(undefined);
          break;
        case queryType.SELECT:
          if (!skipSelect) {
            console.error(
              "validating select query structure not supported yet",
            );
          }
          // TODO INSERT and UPDATE tests here...
          // should be easy...
          break;
        case queryType.INSERT:
          expect(query.qs?.tableName).toBe(expectedStructure.tableName);
          break;
        case queryType.UPDATE:
          expect(query.qs?.tableName).toBe(expectedStructure.tableName);
          break;
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
          query: jest.fn().mockImplementation(QueryRecorder.recordQuery),

          // EventEmitter
          ...eventEmitter,
        };
      },
    );
  }

  // mock loadEdgeDatas and return a simple non-symmetric|non-inverse edge
  // not sure if this is the best way but it's the only way I got
  // long discussion about issues: https://github.com/facebook/jest/issues/936

  static async mockImplOfLoadEdgeDatas(
    ...edgeTypes: string[]
  ): Promise<Map<string, AssocEdgeData>> {
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
  }
}

// TODO
process.env.DB_CONNECTION_STRING = "ss";
