import {
  Allow,
  Ent,
  ID,
  PrivacyPolicyRule,
  Skip,
  Viewer,
} from "@lolopinto/ent";
import { EdgeInputData } from "@lolopinto/ent/action";
import { GuestGroup } from "src/ent/";

export class AllowIfGuestGroupPartOfEventRule implements PrivacyPolicyRule {
  constructor(private eventID: ID, private inputData: EdgeInputData[]) {}

  async apply(v: Viewer, _ent: Ent) {
    const all = await Promise.all(
      this.inputData.map(async (input) => {
        // TODO another example where things are simplified with no Builder?
        if (input.isBuilder(input.id)) {
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
