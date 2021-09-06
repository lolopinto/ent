---
sidebar_position: 1
sidebar_label: "Clause"
---

# Clause

Clause is a predicate used in a WHERE clause.

## Common ones

Framework comes with a few common ones:

* Eq

```ts
export declare function Eq(col: string, value: any): simpleClause;
```

`Eq` takes a column name and value to be used to check for equality in the SQL query. Generates a partial query:

```sql
// postgres
col = $1

// sqlite
col = ?
```

* `Not Equal`, like `Eq` above except the check is for values that are not equal.
* `Greater`, like `Eq` above except the check is for values in row greater than value.
* `Less`, like `Eq` above except the check is for values in row less than value.
* `GreaterEq`, like `Eq` above except the check is for values in row greater than or equal to value.
* `LessEq`, like `Eq` above except the check is for values in row less than or equal to value.
* `And`

```ts
export declare function And(...args: Clause[]): compositeClause;
```

`And` takes one or more Clauses and combines them so that they all have to be true. It takes both simple clauses (Eq, Less) and complex (And, Or, In) ones.

Generates a partial query:

```sql
// postgres
col1 = $1 AND col2 = $2

// sqlite
col1 = ? AND col2 = ?
```

* `Or`, like `And` above except it checks that any is true.

* `In`, takes a column and one or more values to be used in an IN QUERY.

```ts
export declare function In(col: string, ...values: any): Clause;
```

Generates a partial query:

```sql
// postgres
col IN ($1, $2, $3)

// sqlite
col IN (?, ?, ?)
```

## API

API is as follows:

```ts
interface Clause {
  clause(idx: number): string;
  values(): any[];
  instanceKey(): string;
  // values to log when querying
  logValues(): any[];
}
```

* `clause`: takes a positional argument starting with 1 and returns a string with the positional argument taken into consideration for dialects where it applies (Postgres). Current Dialect can be retrieved by calling `DB.getDialect()`
* `values`: returns a list of one or more values that should be passed down to the prepared query
* `instanceKey`: string used to cache Clause when primitive caching applies.
* `logValues`: values to log if database query is being logged. Exists so that we don't log sensitive values such as passwords, social security numbers, etc.

## sensitiveValue

`sensitiveValue` is a function provided by the framework when querying for sensitive values such as passwords, social security numbers, etc.

It passes the correct value to the database engine but ensures that a different value is logged if logging is enabled.
