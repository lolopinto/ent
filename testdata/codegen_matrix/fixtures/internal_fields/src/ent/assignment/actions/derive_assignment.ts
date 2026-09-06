import type { AssignmentBuilder } from "../../generated/assignment/actions/assignment_builder";
import { WriteOperation } from "@snowtop/ent/action";
import { EdgeType } from "../../generated/types";

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
  const override = builder.getStoredData("relationshipOverride");
  if (override) {
    builder.updateInput(override);
  }
}
