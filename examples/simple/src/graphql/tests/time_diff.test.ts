import { Viewer } from "@snowtop/ent";
import {
  expectQueryFromRoot,
  queryRootConfig,
} from "@snowtop/ent-graphql-tests";
import schema from "../generated/schema";
import { ExampleViewer } from "src/viewer/viewer";
import { DateTime } from "luxon";

function getConfig(
  viewer: Viewer,
  time: Date,
  partialConfig?: Partial<queryRootConfig>,
): queryRootConfig {
  return {
    viewer: viewer,
    schema: schema,
    root: "timeDiff",
    args: {
      time,
      log: {},
    },
    ...partialConfig,
  };
}

test("query no time. Date", async () => {
  await expectQueryFromRoot(getConfig(new ExampleViewer(null), new Date()), [
    ".",
    (v: string) => expect(v.startsWith("PT")),
  ]);
});

test("query no time. future", async () => {
  const d = DateTime.fromJSDate(new Date()).plus({ day: 1 });
  await expectQueryFromRoot(getConfig(new ExampleViewer(null), d.toJSDate()), [
    ".",
    (v: string) => expect(v.startsWith("PT")),
  ]);
});
