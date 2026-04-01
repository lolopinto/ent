type NodeID = string;

export class TopologicalGraph {
  private nodes: Set<NodeID> = new Set();
  private edges: Map<NodeID, Set<NodeID>> = new Map();

  addNode(node: NodeID) {
    this.nodes.add(node);
    if (!this.edges.has(node)) {
      this.edges.set(node, new Set());
    }
  }

  addEdge(from: NodeID, to: NodeID) {
    this.addNode(from);
    this.addNode(to);
    this.edges.get(from)!.add(to);
  }

  topologicalSort(): NodeID[] {
    const ordered: NodeID[] = [];
    const seen: Map<NodeID, 0 | 1 | 2> = new Map();

    const visit = (node: NodeID) => {
      const state = seen.get(node);
      if (state === 1) {
        throw new Error("dependency graph contains a cycle");
      }
      if (state === 2) {
        return;
      }

      seen.set(node, 1);
      for (const target of this.edges.get(node) || []) {
        visit(target);
      }
      seen.set(node, 2);
      ordered.push(node);
    };

    for (const node of this.nodes) {
      if (seen.get(node) !== 2) {
        visit(node);
      }
    }

    return ordered.reverse();
  }
}
