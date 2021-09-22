import {
  Allow,
  Ent,
  ID,
  PrivacyPolicyRule,
  Skip,
  Data,
  Viewer,
} from "@snowtop/ent";
import { EdgeInputData } from "@snowtop/ent/action";
import { GuestGroup } from "src/ent/";
import { GuestGroupBuilder } from "src/ent/guest_group/actions/generated/guest_group_builder";

export class AllowIfGuestGroupPartOfEventRule implements PrivacyPolicyRule {
  constructor(private eventID: ID, private inputData: EdgeInputData[]) {}

  async apply(v: Viewer, _ent: Ent) {
    const all = await Promise.all(
      this.inputData.map(async (input) => {
        if (input.isBuilder(input.id)) {
          const b = input.id;
          const rawInput = (b as GuestGroupBuilder).getInput();

          // creating a guest group and we can match the ids
          if (rawInput && rawInput.eventID) {
            return rawInput.eventID === this.eventID;
          }

          // otherwise nope
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
