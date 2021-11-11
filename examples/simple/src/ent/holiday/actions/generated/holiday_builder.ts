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
import { Holiday } from "../../..";
import schema from "../../../../schema/holiday";

export interface HolidayInput {
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
  private input: TData;

  public constructor(
    public readonly viewer: Viewer,
    public readonly operation: WriteOperation,
    action: Action<Holiday, Builder<Holiday>, TData>,
    public readonly existingEnt?: Holiday | undefined,
  ) {
    this.placeholderID = `$ent.idPlaceholderID$ ${randomNum()}-Holiday`;
    this.input = action.getInput();

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

  private getEditedFields(): Map<string, any> {
    const fields = this.input;

    const result = new Map<string, any>();

    const addField = function (key: string, value: any) {
      if (value !== undefined) {
        result.set(key, value);
      }
    };
    addField("label", fields.label);
    addField("date", fields.date);
    return result;
  }

  isBuilder(node: ID | Ent | Builder<Ent>): node is Builder<Ent> {
    return (node as Builder<Ent>).placeholderID !== undefined;
  }

  // get value of label. Retrieves it from the input if specified or takes it from existingEnt
  getNewLabelValue(): string | undefined {
    return this.input.label || this.existingEnt?.label;
  }

  // get value of date. Retrieves it from the input if specified or takes it from existingEnt
  getNewDateValue(): Date | undefined {
    return this.input.date || this.existingEnt?.date;
  }
}
