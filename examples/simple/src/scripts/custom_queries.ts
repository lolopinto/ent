import * as fs from "fs";
import { camelCase } from "camel-case";
import { snakeCase } from "snake-case";
import {
  Schema,
  DBType,
  getStorageKey,
  UUIDType,
  UUIDListType,
} from "@snowtop/ent";

async function main() {
  const paths = fs.readdirSync("src/schema");
  const queries: any[] = [];
  const customTypes: {
    [key: string]: any;
  } = {};
  for (const p of paths) {
    if (!p.endsWith("_schema.ts") || p.startsWith("__global")) {
      continue;
    }
    const query = p.replace("_schema.ts", "");
    const temp = camelCase(query);
    const node = temp.charAt(0).toUpperCase() + temp.substring(1);

    const schema: Schema = require("../schema/" +
      p.substring(0, p.length - 3)).default;
    if (schema.hideFromGraphQL) {
      continue;
    }

    const listArgs = [
      {
        name: "context",
        type: "Context",
        isContextArg: true,
      },
      {
        name: "id",
        type: "ID",
        nullable: true,
      },
      {
        name: "ids",
        type: "ID",
        list: true,
        nullable: true,
      },
      {
        name: "extra",
        type: "Boolean",
        nullable: true,
      },
    ];

    const connectionArg = `${node}ArgInput`;
    const connectionArgType = `${node}ArgInputType`;

    const connectionArgs: any[] = [
      {
        name: "context",
        type: "Context",
        isContextArg: true,
      },
      {
        name: "ids",
        type: "ID",
        list: true,
        nullable: true,
      },
    ];

    const listImports: any = [
      {
        importPath: "src/ent",
        import: node,
      },
      {
        importPath: "@snowtop/ent",
        import: "query",
      },
    ];
    const connectionImports: any = [
      {
        importPath: "src/ent",
        import: node,
      },
      {
        importPath: "@snowtop/ent",
        import: "query",
      },
      {
        importPath: "@snowtop/ent",
        import: "CustomClauseQuery",
      },
    ];

    const sortKeys: {
      [key: string]: string;
    } = {
      id: "id",
    };
    for (const k in schema.fields) {
      const f = schema.fields[k];
      // only uuid fields
      if (f.index || (f.unique && f.type.dbType === DBType.UUID)) {
        sortKeys[k] = getStorageKey(f, k);
      }
    }
    const sortType = `${node}SortColumn`;

    customTypes[sortType] = {
      type: sortType,
      enumMap: sortKeys,
    };
    customTypes[connectionArg] = {
      type: connectionArg,
      structFields: {
        id: UUIDType({ nullable: true }),
        ids: UUIDListType({ nullable: true }),
        // more can be here. we're not actually using it so it's just an example
      },
      inputType: true,
    };

    connectionArgs.push({
      name: "sortCol",
      type: sortType,
      nullable: true,
    });
    connectionArgs.push({
      name: "query",
      type: connectionArg,
      nullable: true,
    });
    connectionImports.push({
      importPath: `src/graphql/generated/mutations/input/${snakeCase(
        connectionArgType,
      )}`,
      import: connectionArgType,
    });

    const listContent = `
    const whereQueries = [
      args.id ? query.Eq('id', args.id) : undefined,
      args.ids ? query.UuidIn('id', args.ids) : undefined,
    ];

    if (whereQueries.filter(q => q !==undefined).length === 0) {
      throw new Error('invalid query. must provid id or ids');
    }

    return ${node}.loadCustom(
      context.getViewer(), 
      // @ts-expect-error Clause shenanigans
      query.AndOptional(...whereQueries),
    );
    `;

    const connectionContent = `
    return new CustomClauseQuery(context.getViewer(),{
      loadEntOptions: ${node}.loaderOptions(),
      clause: query.UuidIn('id', args.ids),
      name: '${node}',
      orderby: [
        {
          // use sortCol value or created_at (not sorted)
          column: args.sortCol ?? 'created_at',
          direction: 'DESC',
        }
      ],
    })
    `;

    queries.push({
      name: `${query}_list_deprecated`,
      list: true,
      fieldType: "ASYNC_FUNCTION",
      nullable: true,
      args: listArgs,
      resultType: node,
      description: `custom query for ${query}. list`,
      extraImports: listImports,
      functionContents: listContent,
    });
    queries.push({
      name: `${query}_connection`,
      edgeName: query,
      connection: true,
      fieldType: "ASYNC_FUNCTION",
      nullable: true,
      args: connectionArgs,
      resultType: node,
      description: `custom query for ${query}. connection`,
      extraImports: connectionImports,
      functionContents: connectionContent,
    });
  }
  console.log(JSON.stringify({ queries, customTypes }));
}

main();
