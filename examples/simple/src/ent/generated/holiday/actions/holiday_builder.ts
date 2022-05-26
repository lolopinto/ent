/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

import { Ent, ID, Viewer } from "@snowtop/ent";
import {
  Action,
  Builder,
  Changeset,
  Orchestrator,
  WriteOperation,
  saveBuilder,
  saveBuilderX,
} from "@snowtop/ent/action";
import { DayOfWeek, DayOfWeekAlt, Holiday } from "../../..";
import { NodeType } from "../../const";
import { holidayLoaderInfo } from "../../loaders";
import schema from "../../../../schema/holiday_schema";

export interface HolidayInput {
  dayOfWeek?: DayOfWeek;
  dayOfWeekAlt?: DayOfWeekAlt | null;
  label?: string;
  date?: Date;
  // allow other properties. useful for action-only fields
  [x: string]: any;
}

function randomNum(): string {
  return Math.random().toString(10).substring(2);
}

export class HolidayBuilder<TData extends HolidayInput = HolidayInput>
  implements Builder<Holiday>
{
  orchestrator: Orchestrator<Holiday, TData>;
  readonly placeholderID: ID;
  readonly ent = Holiday;
  readonly nodeType = NodeType.Holiday;
  private input: TData;
  private m: Map<string, any> = new Map();

  public constructor(
    public readonly viewer: Viewer,
    public readonly operation: WriteOperation,
    action: Action<Holiday, Builder<Holiday>, TData>,
    public readonly existingEnt?: Holiday | undefined,
  ) {
    this.placeholderID = `$ent.idPlaceholderID$ ${randomNum()}-Holiday`;
    this.input = action.getInput();
    const updateInput = (d: HolidayInput) => this.updateInput.apply(this, [d]);

    this.orchestrator = new Orchestrator({
      viewer,
      operation: this.operation,
      tableName: "holidays",
      key: "id",
      loaderOptions: Holiday.loaderOptions(),
      builder: this,
      action,
      schema,
      editedFields: () => this.getEditedFields.apply(this),
      updateInput,
      fieldInfo: holidayLoaderInfo.fieldInfo,
    });
  }

  getInput(): TData {
    return this.input;
  }

  updateInput(input: HolidayInput) {
    // override input
    this.input = {
      ...this.input,
      ...input,
    };
  }

  deleteInputKey(key: keyof HolidayInput) {
    delete this.input[key];
  }

  // store data in Builder that can be retrieved by another validator, trigger, observer later in the action
  storeData(k: string, v: any) {
    this.m.set(k, v);
  }

  // retrieve data stored in this Builder with key
  getStoredData(k: string) {
    return this.m.get(k);
  }

  async build(): Promise<Changeset<Holiday>> {
    return this.orchestrator.build();
  }

  async valid(): Promise<boolean> {
    return this.orchestrator.valid();
  }

  async validX(): Promise<void> {
    return this.orchestrator.validX();
  }

  async save(): Promise<void> {
    await saveBuilder(this);
  }

  async saveX(): Promise<void> {
    await saveBuilderX(this);
  }

  async editedEnt(): Promise<Holiday | null> {
    return this.orchestrator.editedEnt();
  }

  async editedEntX(): Promise<Holiday> {
    return this.orchestrator.editedEntX();
  }

  private async getEditedFields(): Promise<Map<string, any>> {
    const fields = this.input;

    const result = new Map<string, any>();

    const addField = function (key: string, value: any) {
      if (value !== undefined) {
        result.set(key, value);
      }
    };
    addField("dayOfWeek", fields.dayOfWeek);
    addField("dayOfWeekAlt", fields.dayOfWeekAlt);
    addField("label", fields.label);
    addField("date", fields.date);
    return result;
  }

  isBuilder(node: ID | Ent | Builder<Ent>): node is Builder<Ent> {
    return (node as Builder<Ent>).placeholderID !== undefined;
  }

  // get value of dayOfWeek. Retrieves it from the input if specified or takes it from existingEnt
  getNewDayOfWeekValue(): DayOfWeek | undefined {
    if (this.input.dayOfWeek !== undefined) {
      return this.input.dayOfWeek;
    }
    return this.existingEnt?.dayOfWeek;
  }

  // get value of dayOfWeekAlt. Retrieves it from the input if specified or takes it from existingEnt
  getNewDayOfWeekAltValue(): DayOfWeekAlt | null | undefined {
    if (this.input.dayOfWeekAlt !== undefined) {
      return this.input.dayOfWeekAlt;
    }
    return this.existingEnt?.dayOfWeekAlt;
  }

  // get value of label. Retrieves it from the input if specified or takes it from existingEnt
  getNewLabelValue(): string | undefined {
    if (this.input.label !== undefined) {
      return this.input.label;
    }
    return this.existingEnt?.label;
  }

  // get value of date. Retrieves it from the input if specified or takes it from existingEnt
  getNewDateValue(): Date | undefined {
    if (this.input.date !== undefined) {
      return this.input.date;
    }
    return this.existingEnt?.date;
  }
}
