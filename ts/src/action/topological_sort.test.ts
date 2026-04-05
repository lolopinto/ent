import { TopologicalGraph } from "./topological_sort";

function expectNodeBefore(
  sorted: string[],
  dependency: string,
  dependent: string,
) {
  expect(sorted.indexOf(dependency)).toBeGreaterThanOrEqual(0);
  expect(sorted.indexOf(dependent)).toBeGreaterThanOrEqual(0);
  expect(sorted.indexOf(dependency)).toBeLessThan(sorted.indexOf(dependent));
}

describe("TopologicalGraph", () => {
  test("sorts dependencies before dependents and keeps disconnected nodes", () => {
    const graph = new TopologicalGraph();

    graph.addEdge("user", "contact");
    graph.addEdge("contact", "message");
    graph.addEdge("user", "audit_log");
    graph.addNode("settings");

    const sorted = graph.topologicalSort();

    expect(sorted).toHaveLength(5);
    expect(new Set(sorted)).toEqual(
      new Set(["user", "contact", "message", "audit_log", "settings"]),
    );
    expectNodeBefore(sorted, "user", "contact");
    expectNodeBefore(sorted, "contact", "message");
    expectNodeBefore(sorted, "user", "audit_log");
  });

  test("throws on cycles", () => {
    const graph = new TopologicalGraph();

    graph.addEdge("a", "b");
    graph.addEdge("b", "a");

    expect(() => graph.topologicalSort()).toThrow("Cycle found");
  });
});
