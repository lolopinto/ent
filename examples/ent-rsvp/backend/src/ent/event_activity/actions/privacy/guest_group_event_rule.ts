import { Allow, Ent, ID, PrivacyPolicyRule, Skip, Viewer } from "@snowtop/ent";
import { EdgeInputData } from "@snowtop/ent/action";
import { GuestGroup } from "src/ent/";
import { GuestGroupBuilder } from "src/ent/generated/guest_group/actions/guest_group_builder";

export class AllowIfGuestGroupPartOfEventRule implements PrivacyPolicyRule {
  constructor(
    private eventId: ID,
    private inputData: EdgeInputData[],
  ) {}

  async apply(v: Viewer, _ent: Ent) {
    const all = await Promise.all(
      this.inputData.map(async (input) => {
        if (input.isBuilder(input.id)) {
          const b = input.id;
          const rawInput = (b as GuestGroupBuilder).getInput();

          // creating a guest group and we can match the ids
          if (rawInput && rawInput.eventId) {
            return rawInput.eventId === this.eventId;
          }

          // otherwise nope
          return false;
        }
        const loaded = await GuestGroup.load(v, input.id);
        return loaded?.eventId == this.eventId;
      }),
    );
    if (all.every((val) => val)) {
      return Allow();
    }
    return Skip();
  }
}
