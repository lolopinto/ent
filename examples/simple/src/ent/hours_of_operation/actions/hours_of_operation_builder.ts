// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import { Viewer, ID, Ent } from "@lolopinto/ent";
import {
  Action,
  Builder,
  WriteOperation,
  Changeset,
  saveBuilder,
  saveBuilderX,
  Orchestrator,
} from "@lolopinto/ent/action";
import { dayOfWeek, HoursOfOperation } from "src/ent/";
import schema from "src/schema/hours_of_operation";

export interface HoursOfOperationInput {
  dayOfWeek?: dayOfWeek;
  open?: Date;
  close?: Date;
}

export interface HoursOfOperationAction extends Action<HoursOfOperation> {
  getInput(): HoursOfOperationInput;
}

function randomNum(): string {
  return Math.random().toString(10).substring(2);
}

export class HoursOfOperationBuilder implements Builder<HoursOfOperation> {
  orchestrator: Orchestrator<HoursOfOperation>;
  readonly placeholderID: ID;
  readonly ent = HoursOfOperation;
  private input: HoursOfOperationInput;

  public constructor(
    public readonly viewer: Viewer,
    public readonly operation: WriteOperation,
    action: HoursOfOperationAction,
    public readonly existingEnt?: HoursOfOperation | undefined,
  ) {
    this.placeholderID = `$ent.idPlaceholderID$ ${randomNum()}-HoursOfOperation`;
    this.input = action.getInput();

    this.orchestrator = new Orchestrator({
      viewer: viewer,
      operation: this.operation,
      tableName: "hours_of_operations",
      key: "id",
      loaderOptions: HoursOfOperation.loaderOptions(),
      builder: this,
      action: action,
      schema: schema,
      editedFields: () => {
        return this.getEditedFields.apply(this);
      },
    });
  }

  getInput(): HoursOfOperationInput {
    return this.input;
  }

  updateInput(input: HoursOfOperationInput) {
    // override input
    this.input = {
      ...this.input,
      ...input,
    };
  }

  async build(): Promise<Changeset<HoursOfOperation>> {
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

  async editedEnt(): Promise<HoursOfOperation | null> {
    return await this.orchestrator.editedEnt();
  }

  async editedEntX(): Promise<HoursOfOperation> {
    return await this.orchestrator.editedEntX();
  }

  private getEditedFields(): Map<string, any> {
    const fields = this.input;

    let result = new Map<string, any>();

    const addField = function (key: string, value: any) {
      if (value !== undefined) {
        result.set(key, value);
      }
    };
    addField("dayOfWeek", fields.dayOfWeek);
    addField("open", fields.open);
    addField("close", fields.close);
    return result;
  }

  isBuilder(node: ID | Ent | Builder<Ent>): node is Builder<Ent> {
    return (node as Builder<Ent>).placeholderID !== undefined;
  }

  // get value of dayOfWeek. Retrieves it from the input if specified or takes it from existingEnt
  getNewDayOfWeekValue(): dayOfWeek | undefined {
    return this.input.dayOfWeek || this.existingEnt?.dayOfWeek;
  }

  // get value of open. Retrieves it from the input if specified or takes it from existingEnt
  getNewOpenValue(): Date | undefined {
    return this.input.open || this.existingEnt?.open;
  }

  // get value of close. Retrieves it from the input if specified or takes it from existingEnt
  getNewCloseValue(): Date | undefined {
    return this.input.close || this.existingEnt?.close;
  }
}
