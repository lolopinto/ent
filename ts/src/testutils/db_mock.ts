import { v4 as uuidv4 } from "uuid";
import { Pool, PoolClient } from "pg";
import { mocked } from "ts-jest/utils";
import { ID, Ent, Data } from "../core/base";
import { Clause } from "../core/clause";

import { performQuery, queryResult, getDataToReturn } from "./parse_sql";

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
  columns?: string[];
  whereClause?: string;
  suffix?: string;
  setClause?: string;
}

export class QueryRecorder {
  private static queries: queryOptions[] = [];
  private static ids: ID[] = [];

  // we need pkeys when storing...
  private static data: Map<string, Data[]> = new Map();

  // TODO kill use AST or just throw away
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
          columns: execArray[2].split(", "),
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
          columns: execArray[1].split(", "),
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

  private static recordQuery(
    query: string,
    values: any[],
  ): queryResult | undefined {
    let qs = QueryRecorder.getQueryStructure(query);
    QueryRecorder.queries.push({
      query: query,
      values: values,
      qs: qs,
    });

    return performQuery(query, values, QueryRecorder.data);
  }

  static newID(): ID {
    let id = uuidv4();
    QueryRecorder.ids.push(id);
    return id;
  }

  static getCurrentIDs(): ID[] {
    return QueryRecorder.ids;
  }

  static getData() {
    return QueryRecorder.data;
  }

  static filterData(tableName: string, filterfn: (row: Data) => boolean) {
    const rows = QueryRecorder.data.get(tableName) || [];
    let result: Data[] = [];
    for (const row of rows) {
      // transform the data into whatever the return value should be before filtering
      const row2 = getDataToReturn(row, undefined, true);
      if (filterfn(row2)) {
        result.push(row2);
      }
    }
    return result;
  }

  static clear() {
    QueryRecorder.queries = [];
    QueryRecorder.ids = [];
    QueryRecorder.data = new Map();
  }

  static clearQueries() {
    // clears queries but keeps data
    // this is useful for situations like write this data before each test
    // but each test shouldn't have to account for this
    QueryRecorder.queries = [];
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
    //    return;
    let queries = QueryRecorder.queries;
    //    console.log(queries, expected);
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

  static validateQueryStructuresInTx(
    expected: queryStructure[],
    pre?: queryStructure[],
  ) {
    expected.unshift({ type: queryType.BEGIN });
    expected.push({ type: queryType.COMMIT });
    // we don't care about reads so skipping them for now.
    let pre2 = pre || [];
    expected.unshift(...pre2);
    this.validateQueryStructures(expected, true);
  }

  static validateFailedQueryStructuresInTx(
    expected: queryStructure[],
    pre?: queryStructure[],
  ) {
    expected.unshift({ type: queryType.BEGIN });
    expected.push({ type: queryType.ROLLBACK });
    // we don't care about reads so skipping them for now.
    let pre2 = pre || [];
    expected.unshift(...pre2);
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
    //    console.log(queries, expected);
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
          expect(query.query.startsWith("INSERT")).toBe(true);
          expect(query.qs?.tableName).toBe(expectedStructure.tableName);
          break;
        case queryType.UPDATE:
          expect(query.query.startsWith("UPDATE")).toBe(true);
          expect(query.qs?.tableName).toBe(expectedStructure.tableName);
          break;
      }
    }
  }

  static mockPool(pool: typeof Pool) {
    const mockedPool = mocked(pool, true);
    mockedPool.mockImplementation((): Pool => {
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
    });
  }
}

// TODO
process.env.DB_CONNECTION_STRING = "INVALID DATABASE";
