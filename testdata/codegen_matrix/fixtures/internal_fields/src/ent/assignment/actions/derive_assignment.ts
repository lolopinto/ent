import type { AssignmentBuilder } from "../../generated/assignment/actions/assignment_builder";
import { WriteOperation } from "@snowtop/ent/action";
import { EdgeType, NodeType } from "../../generated/types";

export function deriveAssignment(builder: AssignmentBuilder) {
  builder.storeData(
    "defaultOwnersBeforeTrigger",
    builder.orchestrator
      .getInputEdges(
        EdgeType.ContactToDefaultAssignments,
        WriteOperation.Insert,
      )
      .map((edge) => edge.id),
  );
  const enrich = builder.getStoredData("enrichRelationship");
  if (enrich) {
    for (const edge of builder.orchestrator.getInputEdges(
      enrich.edgeType,
      WriteOperation.Insert,
    )) {
      builder.orchestrator.addInboundEdge(
        edge.id,
        edge.edgeType,
        edge.nodeType!,
        { data: "enriched" },
      );
    }
    builder.orchestrator.addInboundEdge(
      enrich.manualOwner,
      enrich.edgeType,
      NodeType.Contact,
      { data: "manual" },
    );
    builder.orchestrator.removeInboundEdge(
      enrich.removedOwner,
      enrich.edgeType,
    );
  }
  const override = builder.getStoredData("relationshipOverride");
  if (override) {
    builder.updateInput(override);
  }
}
