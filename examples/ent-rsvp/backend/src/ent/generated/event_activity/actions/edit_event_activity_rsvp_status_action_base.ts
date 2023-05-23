// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  AllowIfViewerHasIdentityPrivacyPolicy,
  ID,
  PrivacyPolicy,
  Viewer,
} from "@snowtop/ent";
import {
  Action,
  Changeset,
  ChangesetOptions,
  Observer,
  Trigger,
  Validator,
  WriteOperation,
  setEdgeTypeInGroup,
} from "@snowtop/ent/action";
import { EventActivity } from "src/ent/";
import { EventActivityBuilder } from "src/ent/generated/event_activity/actions/event_activity_builder";
import { NodeType } from "src/ent/generated/types";

export enum EventActivityRsvpStatusInput {
  Attending = "attending",
  Declined = "declined",
  Unknown = "%unknown%",
}

export function convertEventActivityRsvpStatusInput(
  val: string,
): EventActivityRsvpStatusInput {
  switch (val) {
    case EventActivityRsvpStatusInput.Attending:
    case EventActivityRsvpStatusInput.Declined:
    case EventActivityRsvpStatusInput.Unknown:
      return val;
    default:
      return EventActivityRsvpStatusInput.Unknown;
  }
}

export function convertNullableEventActivityRsvpStatusInput(
  val: string | null,
): EventActivityRsvpStatusInput | null {
  if (val === null || val === undefined) {
    return null;
  }
  return convertEventActivityRsvpStatusInput(val);
}

export function convertEventActivityRsvpStatusInputList(
  val: string[],
): EventActivityRsvpStatusInput[] {
  return val.map((v) => convertEventActivityRsvpStatusInput(v));
}

export function convertNullableEventActivityRsvpStatusInputList(
  val: string[] | null,
): EventActivityRsvpStatusInput[] | null {
  if (val === null || val === undefined) {
    return null;
  }
  return convertEventActivityRsvpStatusInputList(val);
}

export interface EditEventActivityRsvpStatusInput {
  rsvpStatus: EventActivityRsvpStatusInput;
  guestID: ID;
  dietaryRestrictions?: string | null;
}

export type EditEventActivityRsvpStatusActionTriggers = (
  | Trigger<
      EventActivity,
      EventActivityBuilder<EditEventActivityRsvpStatusInput, EventActivity>,
      Viewer,
      EditEventActivityRsvpStatusInput,
      EventActivity
    >
  | Trigger<
      EventActivity,
      EventActivityBuilder<EditEventActivityRsvpStatusInput, EventActivity>,
      Viewer,
      EditEventActivityRsvpStatusInput,
      EventActivity
    >[]
)[];

export type EditEventActivityRsvpStatusActionObservers = Observer<
  EventActivity,
  EventActivityBuilder<EditEventActivityRsvpStatusInput, EventActivity>,
  Viewer,
  EditEventActivityRsvpStatusInput,
  EventActivity
>[];

export type EditEventActivityRsvpStatusActionValidators = Validator<
  EventActivity,
  EventActivityBuilder<EditEventActivityRsvpStatusInput, EventActivity>,
  Viewer,
  EditEventActivityRsvpStatusInput,
  EventActivity
>[];

export class EditEventActivityRsvpStatusActionBase
  implements
    Action<
      EventActivity,
      EventActivityBuilder<EditEventActivityRsvpStatusInput, EventActivity>,
      Viewer,
      EditEventActivityRsvpStatusInput,
      EventActivity
    >
{
  public readonly builder: EventActivityBuilder<
    EditEventActivityRsvpStatusInput,
    EventActivity
  >;
  public readonly viewer: Viewer;
  protected input: EditEventActivityRsvpStatusInput;
  protected readonly eventActivity: EventActivity;

  constructor(
    viewer: Viewer,
    eventActivity: EventActivity,
    input: EditEventActivityRsvpStatusInput,
  ) {
    this.viewer = viewer;
    this.input = input;
    this.builder = new EventActivityBuilder(
      this.viewer,
      WriteOperation.Edit,
      this,
      eventActivity,
    );
    this.eventActivity = eventActivity;
  }

  getPrivacyPolicy(): PrivacyPolicy<EventActivity, Viewer> {
    return AllowIfViewerHasIdentityPrivacyPolicy;
  }

  getTriggers(): EditEventActivityRsvpStatusActionTriggers {
    return [];
  }

  getObservers(): EditEventActivityRsvpStatusActionObservers {
    return [];
  }

  getValidators(): EditEventActivityRsvpStatusActionValidators {
    return [];
  }

  getInput(): EditEventActivityRsvpStatusInput {
    return this.input;
  }

  async changeset(): Promise<Changeset> {
    await this.setEdgeType();
    return this.builder.build();
  }

  async changesetWithOptions_BETA(
    options: ChangesetOptions,
  ): Promise<Changeset> {
    await this.setEdgeType();
    return this.builder.buildWithOptions_BETA(options);
  }

  private async setEdgeType() {
    await setEdgeTypeInGroup(
      this.builder.orchestrator,
      this.input.rsvpStatus,
      this.eventActivity.id,
      this.input.guestID,
      NodeType.EventActivity,
      this.eventActivity.getEventActivityRsvpStatusMap(),
    );
  }

  async valid(): Promise<boolean> {
    await this.setEdgeType();
    return this.builder.valid();
  }

  async validX(): Promise<void> {
    await this.setEdgeType();
    await this.builder.validX();
  }

  async save(): Promise<EventActivity | null> {
    await this.setEdgeType();
    await this.builder.save();
    return this.builder.editedEnt();
  }

  async saveX(): Promise<EventActivity> {
    await this.setEdgeType();
    await this.builder.saveX();
    return this.builder.editedEntX();
  }

  static create<T extends EditEventActivityRsvpStatusActionBase>(
    this: new (
      viewer: Viewer,
      eventActivity: EventActivity,
      input: EditEventActivityRsvpStatusInput,
    ) => T,
    viewer: Viewer,
    eventActivity: EventActivity,
    input: EditEventActivityRsvpStatusInput,
  ): T {
    return new this(viewer, eventActivity, input);
  }

  static async saveXFromID<T extends EditEventActivityRsvpStatusActionBase>(
    this: new (
      viewer: Viewer,
      eventActivity: EventActivity,
      input: EditEventActivityRsvpStatusInput,
    ) => T,
    viewer: Viewer,
    id: ID,
    input: EditEventActivityRsvpStatusInput,
  ): Promise<EventActivity> {
    const eventActivity = await EventActivity.loadX(viewer, id);
    return new this(viewer, eventActivity, input).saveX();
  }
}
