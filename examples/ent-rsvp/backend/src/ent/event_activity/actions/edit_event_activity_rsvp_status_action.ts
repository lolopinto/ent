import { AlwaysDenyRule, AssocEdge, Ent, loadEdgeForID2 } from "@snowtop/ent";
import { Changeset, Trigger, WriteOperation } from "@snowtop/ent/action";
import {
  DenyIfEdgeDoesNotExistRule,
  DelayedResultRule,
  DenyIfLoggedOutRule,
} from "@snowtop/ent/core/privacy";
import { Guest, GuestData } from "src/ent";
import { EdgeType } from "src/ent/generated/const";
import {
  EditEventActivityRsvpStatusActionBase,
  EditEventActivityRsvpStatusInput,
  EventActivityRsvpStatusInput,
} from "src/ent/event_activity/actions/generated/edit_event_activity_rsvp_status_action_base";
import { AllowIfGuestInSameGuestGroupRule } from "src/ent/guest/privacy/guest_rule_privacy";
import DeleteGuestDataAction from "src/ent/guest_data/actions/delete_guest_data_action";
import CreateGuestDataAction from "../../guest_data/actions/create_guest_data_action";
import { EventActivityBuilder } from "./generated/event_activity_builder";

export { EditEventActivityRsvpStatusInput };
export { EventActivityRsvpStatusInput };

// we're only writing this once except with --force and packageName provided
export default class EditEventActivityRsvpStatusAction extends EditEventActivityRsvpStatusActionBase {
  getPrivacyPolicy() {
    return {
      rules: [
        DenyIfLoggedOutRule,
        // group guest is a part of needs to be invited
        new DelayedResultRule(async (_v, _ent) => {
          const guest = await Guest.loadX(
            this.builder.viewer,
            this.input.guestID,
          );
          return new DenyIfEdgeDoesNotExistRule(
            this.builder.existingEnt!.id,
            guest.guestGroupID,
            EdgeType.EventActivityToInvites,
          );
        }),

        new AllowIfGuestInSameGuestGroupRule(this.input.guestID),
        AlwaysDenyRule,
      ],
    };
  }

  triggers = [
    // this addds the 3-way edge if it exists...
    {
      changeset: async (
        builder: EventActivityBuilder,
        input: EditEventActivityRsvpStatusInput,
      ): Promise<void | Changeset<Ent>[]> => {
        if (!input.dietaryRestrictions || !builder.existingEnt) {
          return;
        }
        const ent = builder.existingEnt;
        const dietaryRestrictions = input.dietaryRestrictions;

        const edges = builder.getEdgeInputData(
          EdgeType.EventActivityToAttending,
          WriteOperation.Insert,
        );
        return await Promise.all(
          edges.map(async (edge) => {
            if (edge.isBuilder(edge.id)) {
              throw new Error("edge should not be a builder");
            }
            const action = CreateGuestDataAction.create(builder.viewer, {
              guestID: edge.id,
              eventID: ent.eventID,
              dietaryRestrictions: dietaryRestrictions,
            });
            builder.addAttendingID(edge.id, {
              data: action.builder,
              time: edge.options?.time,
            });
            return action.changeset();
          }),
        );
      },
    },
    {
      // this is less important but we have this to clear any hanging objects as we delete the edge
      changeset: async (
        builder: EventActivityBuilder,
        input: EditEventActivityRsvpStatusInput,
      ): Promise<void | Changeset<Ent>[]> => {
        if (!builder.existingEnt) {
          return;
        }
        const edges = builder.getEdgeInputData(
          EdgeType.EventActivityToAttending,
          WriteOperation.Delete,
        );
        const ent = builder.existingEnt;

        let c = await Promise.all(
          edges.map(async (edge) => {
            if (edge.isBuilder(edge.id)) {
              throw new Error("edge should not be a builder");
            }

            const edgeData = await loadEdgeForID2({
              id1: ent.id,
              id2: edge.id,
              edgeType: EdgeType.EventActivityToAttending,
              ctr: AssocEdge,
            });

            if (!edgeData || !edgeData.data) {
              return;
            }

            const gData = await GuestData.loadX(builder.viewer, edgeData.data);

            return DeleteGuestDataAction.create(
              builder.viewer,
              gData,
            ).changeset();
          }),
        );
        return c.filter((c) => c) as Changeset<Ent>[];
      },
    },
  ];
}
