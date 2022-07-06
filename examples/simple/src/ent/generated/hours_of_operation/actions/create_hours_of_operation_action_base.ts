/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

import {
  AllowIfViewerHasIdentityPrivacyPolicy,
  PrivacyPolicy,
} from "@snowtop/ent";
import {
  Action,
  Changeset,
  Observer,
  Trigger,
  Validator,
  WriteOperation,
} from "@snowtop/ent/action";
import { DayOfWeek, DayOfWeekAlt, HoursOfOperation } from "../../..";
import { HoursOfOperationBuilder } from "./hours_of_operation_builder";
import { ExampleViewer as ExampleViewerAlias } from "../../../../viewer/viewer";

export interface HoursOfOperationCreateInput {
  dayOfWeek: DayOfWeek;
  dayOfWeekAlt?: DayOfWeekAlt | null;
  open: string;
  close: string;
}

export type CreateHoursOfOperationActionTriggers = (
  | Trigger<
      HoursOfOperation,
      HoursOfOperationBuilder<
        HoursOfOperationCreateInput,
        HoursOfOperation | null
      >,
      ExampleViewerAlias,
      HoursOfOperationCreateInput,
      HoursOfOperation | null
    >
  | Trigger<
      HoursOfOperation,
      HoursOfOperationBuilder<
        HoursOfOperationCreateInput,
        HoursOfOperation | null
      >,
      ExampleViewerAlias,
      HoursOfOperationCreateInput,
      HoursOfOperation | null
    >[]
)[];

export type CreateHoursOfOperationActionObservers = Observer<
  HoursOfOperation,
  HoursOfOperationBuilder<HoursOfOperationCreateInput, HoursOfOperation | null>,
  ExampleViewerAlias,
  HoursOfOperationCreateInput,
  HoursOfOperation | null
>[];

export type CreateHoursOfOperationActionValidators = Validator<
  HoursOfOperation,
  HoursOfOperationBuilder<HoursOfOperationCreateInput, HoursOfOperation | null>,
  ExampleViewerAlias,
  HoursOfOperationCreateInput,
  HoursOfOperation | null
>[];

export class CreateHoursOfOperationActionBase
  implements
    Action<
      HoursOfOperation,
      HoursOfOperationBuilder<
        HoursOfOperationCreateInput,
        HoursOfOperation | null
      >,
      ExampleViewerAlias,
      HoursOfOperationCreateInput,
      HoursOfOperation | null
    >
{
  public readonly builder: HoursOfOperationBuilder<
    HoursOfOperationCreateInput,
    HoursOfOperation | null
  >;
  public readonly viewer: ExampleViewerAlias;
  protected input: HoursOfOperationCreateInput;

  constructor(viewer: ExampleViewerAlias, input: HoursOfOperationCreateInput) {
    this.viewer = viewer;
    this.input = input;
    this.builder = new HoursOfOperationBuilder(
      this.viewer,
      WriteOperation.Insert,
      this,
      null,
    );
  }

  getPrivacyPolicy(): PrivacyPolicy<HoursOfOperation> {
    return AllowIfViewerHasIdentityPrivacyPolicy;
  }

  getTriggers(): CreateHoursOfOperationActionTriggers {
    return [];
  }

  getObservers(): CreateHoursOfOperationActionObservers {
    return [];
  }

  getValidators(): CreateHoursOfOperationActionValidators {
    return [];
  }

  getInput(): HoursOfOperationCreateInput {
    return this.input;
  }

  async changeset(): Promise<Changeset> {
    return this.builder.build();
  }

  async valid(): Promise<boolean> {
    return this.builder.valid();
  }

  async validX(): Promise<void> {
    await this.builder.validX();
  }

  async save(): Promise<HoursOfOperation | null> {
    await this.builder.save();
    return this.builder.editedEnt();
  }

  async saveX(): Promise<HoursOfOperation> {
    await this.builder.saveX();
    return this.builder.editedEntX();
  }

  static create<T extends CreateHoursOfOperationActionBase>(
    this: new (
      viewer: ExampleViewerAlias,
      input: HoursOfOperationCreateInput,
    ) => T,
    viewer: ExampleViewerAlias,
    input: HoursOfOperationCreateInput,
  ): T {
    return new this(viewer, input);
  }
}
