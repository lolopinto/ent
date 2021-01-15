import {
  Allow,
  Ent,
  ID,
  PrivacyPolicyRule,
  Skip,
  Viewer,
  AssocEdgeInputOptions,
} from "@lolopinto/ent";
import { Builder } from "@lolopinto/ent/action";
import { GuestGroup } from "src/ent/";

// TODO we should expose this...
// TODO we should have isBuilder as part of interface
interface EdgeInputData {
  edgeType: string;
  id: Builder<Ent> | ID;
  nodeType?: string;
  options?: AssocEdgeInputOptions;
}

function isBuilder(id: Builder<Ent> | ID): id is Builder<Ent> {
  return (id as Builder<Ent>).placeholderID !== undefined;
}

export class AllowIfGuestGroupPartOfEventRule implements PrivacyPolicyRule {
  constructor(private eventID: ID, private inputData: EdgeInputData[]) {}

  async apply(v: Viewer, ent: Ent) {
    const all = await Promise.all(
      this.inputData.map(async (input) => {
        // TODO another example where things are simplified with no Builder?
        if (isBuilder(input.id)) {
          return false;
        }
        const loaded = await GuestGroup.load(v, input.id);
        return loaded?.eventID == this.eventID;
      }),
    );
    if (all.every((val) => val)) {
      return Allow();
    }
    return Skip();
  }
}
