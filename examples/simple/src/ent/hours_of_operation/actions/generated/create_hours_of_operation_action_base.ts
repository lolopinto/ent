/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

import {
  AllowIfViewerHasIdentityPrivacyPolicy,
  PrivacyPolicy,
  Viewer,
} from "@snowtop/ent";
import { Action, Changeset, WriteOperation } from "@snowtop/ent/action";
import { DayOfWeek, DayOfWeekAlt, HoursOfOperation } from "../../..";
import { HoursOfOperationBuilder } from "./hours_of_operation_builder";

export interface HoursOfOperationCreateInput {
  dayOfWeek: DayOfWeek;
  dayOfWeekAlt?: DayOfWeekAlt | null;
  open: string;
  close: string;
}

export class CreateHoursOfOperationActionBase
  implements
    Action<
      HoursOfOperation,
      HoursOfOperationBuilder<HoursOfOperationCreateInput>,
      HoursOfOperationCreateInput
    >
{
  public readonly builder: HoursOfOperationBuilder<HoursOfOperationCreateInput>;
  public readonly viewer: Viewer;
  protected input: HoursOfOperationCreateInput;

  constructor(viewer: Viewer, input: HoursOfOperationCreateInput) {
    this.viewer = viewer;
    this.input = input;
    this.builder = new HoursOfOperationBuilder(
      this.viewer,
      WriteOperation.Insert,
      this,
    );
  }

  getPrivacyPolicy(): PrivacyPolicy<HoursOfOperation> {
    return AllowIfViewerHasIdentityPrivacyPolicy;
  }

  getInput(): HoursOfOperationCreateInput {
    return this.input;
  }

  async changeset(): Promise<Changeset<HoursOfOperation>> {
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
    this: new (viewer: Viewer, input: HoursOfOperationCreateInput) => T,
    viewer: Viewer,
    input: HoursOfOperationCreateInput,
  ): T {
    return new this(viewer, input);
  }
}
