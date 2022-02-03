import { Data } from "@snowtop/ent";

// TODO move this to @snowtop/ent
// this transforms an input for union types from graphql format to TS format
// in graphql, we represent it as UnionType =  {foo: FooType, bar: BarType, baz: BazType}
// in TS, we repseent it as UnionType = FooType | BarType | BazType
// this takes an input, paths to unions and transforms them as needed
// only works on fields that are defined. depends on graphql to handle nullable/missing fields
export function transformUnionTypes<T extends Data>(
  input: T,
  pathsList: string[][],
) {
  for (const paths of pathsList) {
    const lastPath = paths[paths.length - 1];
    let last: Data = input;
    for (const path of paths) {
      let curr = last[path];

      if (curr === undefined) {
        break;
      }
      if (path === lastPath) {
        let count = 0;
        let lastKey: string | undefined = undefined;
        for (const k in curr) {
          count++;
          lastKey = k;
        }
        if (count != 1) {
          throw new Error(
            `can only only pass one key of union. passed ${count}`,
          );
        }
        last[path] = curr[lastKey!];
      }
      last = curr;
    }
  }
  return input;
}
