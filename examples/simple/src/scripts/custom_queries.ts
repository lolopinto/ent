import * as fs from "fs";
import { camelCase } from "camel-case";

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

    const args = [
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

    // RequestContext etc automatic?
    const imports: any = [
      {
        importPath: "src/ent",
        import: node,
      },
      {
        importPath: "@snowtop/ent",
        import: "query",
      },
    ];

    const content = `
    const whereQueries = [
      args.id ? query.Eq('id',id):undefined,
      args.ids ? query.Eq('ids',ids):undefined,
    ];

    if (whereQueries.filter(q => q !==undefined).length === 0) {
      throw new Error('invalid query. must provid id or ids');
    }

    return ${node}.loadCustom(args.context.getViewer(), query.AndOptional(...whereQueries));
    `;

    // TODO confirm we need all this???
    // TODO how to transform the type and call parse.ts....
    queries.push({
      class: node,
      name: query,
      graphQLName: query,
      list: true,
      fieldType: "ASYNC_FUNCTION",
      nullable: true,
      args,
      resultType: node,
      description: `custom query for ${query}`,
      extraImports: imports,
      functionContents: content,
    });
    // console.log(p);
  }
  console.log(queries);
}

main();
