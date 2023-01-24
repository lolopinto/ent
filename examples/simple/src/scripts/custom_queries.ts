import * as fs from "fs";
import { camelCase } from "camel-case";
import { Schema } from "@snowtop/ent";

async function main() {
  const paths = fs.readdirSync("src/schema");
  const queries: any[] = [];
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
    const connectionArgs = [
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

    const listContent = `
    const whereQueries = [
      args.id ? query.Eq('id', args.id) : undefined,
      args.ids ? query.In('id', ...args.ids) : undefined,
    ];

    if (whereQueries.filter(q => q !==undefined).length === 0) {
      throw new Error('invalid query. must provid id or ids');
    }

    return ${node}.loadCustom(context.getViewer(), query.AndOptional(...whereQueries));
    `;

    const connectionContent = `
    return new CustomClauseQuery(context.getViewer(),{
      loadEntOptions: ${node}.loaderOptions(),
      clause: query.In('id', args.ids),
      name: '${node}',
      // not sorted but ok
      sortColumn: 'created_at',
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
  console.log(JSON.stringify({ queries }));
}

main();
