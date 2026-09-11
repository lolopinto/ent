/** Restrict validation SQL to one query without transaction control or writes. */
export function assertValidationQuery(sql: string): void {
  const invalid = () => {
    throw new Error("scope validation only supports a single read query");
  };
  let statement = "";
  for (let i = 0; i < sql.length; ) {
    if (sql.startsWith("--", i)) {
      const offset = sql.slice(i + 2).search(/[\r\n]/);
      i = offset === -1 ? sql.length : i + 2 + offset;
      statement += " ";
    } else if (sql.startsWith("/*", i)) {
      let depth = 1;
      i += 2;
      while (i < sql.length && depth) {
        if (sql.startsWith("/*", i)) {
          depth++;
          i += 2;
        } else if (sql.startsWith("*/", i)) {
          depth--;
          i += 2;
        } else {
          i++;
        }
      }
      if (depth) {
        invalid();
      }
      statement += " ";
    } else if (sql[i] === "'" || sql[i] === '"') {
      const quote = sql[i];
      const escaped =
        quote === "'" &&
        /(?:^|[^a-zA-Z0-9_$\u0080-\uffff])[eE]$/.test(sql.slice(0, i));
      let closed = false;
      i++;
      while (i < sql.length) {
        // Ordinary string escaping depends on a mutable PostgreSQL setting.
        // Require parameters, dollar quotes, or explicit E strings for backslashes.
        if (quote === "'" && !escaped && sql[i] === "\\") {
          invalid();
        }
        if (escaped && sql[i] === "\\") {
          i += 2;
        } else if (sql[i] === quote) {
          i++;
          if (sql[i] === quote) {
            i++;
          } else {
            closed = true;
            break;
          }
        } else {
          i++;
        }
      }
      if (!closed) {
        invalid();
      }
      statement += " ";
    } else {
      const tag =
        sql[i] === "$" &&
        (i === 0 || !/[a-zA-Z0-9_$\u0080-\uffff]/.test(sql[i - 1]))
          ? sql.slice(i).match(/^\$(?:[a-zA-Z_][a-zA-Z_0-9]*)?\$/)?.[0]
          : undefined;
      if (tag) {
        const end = sql.indexOf(tag, i + tag.length);
        if (end === -1) {
          invalid();
        }
        i = end + tag.length;
        statement += " ";
      } else {
        statement += sql[i++];
      }
    }
  }
  statement = statement.trim().replace(/;$/, "");
  if (
    !/^(select|with|values)\b/i.test(statement) ||
    statement.includes(";") ||
    /\b(insert|update|delete|merge|into|call|do|copy|create|alter|drop|truncate|grant|revoke|lock|set|reset|discard|begin|start|commit|rollback|abort|savepoint|release|prepare|execute|deallocate|vacuum|analyze|cluster|refresh|reindex|checkpoint|listen|unlisten|notify)\b/i.test(
      statement,
    ) ||
    /\bfor\s+(?:key\s+)?share\b/i.test(statement)
  ) {
    invalid();
  }
}
