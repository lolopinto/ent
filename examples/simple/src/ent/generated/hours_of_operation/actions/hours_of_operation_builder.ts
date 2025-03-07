/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

import { Ent, ID } from "@snowtop/ent";
import {
  Action,
  Builder,
  Changeset,
  ChangesetOptions,
  Orchestrator,
  OrchestratorOptions,
  WriteOperation,
  saveBuilder,
  saveBuilderX,
} from "@snowtop/ent/action";
import { HoursOfOperation } from "../../..";
import { hoursOfOperationLoaderInfo } from "../../loaders";
import { DayOfWeek, DayOfWeekAlt, NodeType } from "../../types";
import schema from "../../../../schema/hours_of_operation_schema";
import { ExampleViewer as ExampleViewerAlias } from "../../../../viewer/viewer";

export interface HoursOfOperationInput {
  dayOfWeek?: DayOfWeek;
  dayOfWeekAlt?: DayOfWeekAlt | null;
  open?: string;
  close?: string;
  // allow other properties. useful for action-only fields
  [x: string]: any;
}

function randomNum(): string {
  return Math.random().toString(10).substring(2);
}

type MaybeNull<T extends Ent> = T | null;
type TMaybleNullableEnt<T extends Ent> = T | MaybeNull<T>;

export class HoursOfOperationBuilder<
  TInput extends HoursOfOperationInput = HoursOfOperationInput,
  TExistingEnt extends
    TMaybleNullableEnt<HoursOfOperation> = HoursOfOperation | null,
> implements Builder<HoursOfOperation, ExampleViewerAlias, TExistingEnt>
{
  orchestrator: Orchestrator<
    HoursOfOperation,
    TInput,
    ExampleViewerAlias,
    TExistingEnt
  >;
  readonly placeholderID: ID;
  readonly ent = HoursOfOperation;
  readonly nodeType = NodeType.HoursOfOperation;
  private input: TInput;
  private m: Map<string, any> = new Map();

  public constructor(
    public readonly viewer: ExampleViewerAlias,
    public readonly operation: WriteOperation,
    action: Action<
      HoursOfOperation,
      Builder<HoursOfOperation, ExampleViewerAlias, TExistingEnt>,
      ExampleViewerAlias,
      TInput,
      TExistingEnt
    >,
    public readonly existingEnt: TExistingEnt,
    opts?: Partial<
      OrchestratorOptions<
        HoursOfOperation,
        TInput,
        ExampleViewerAlias,
        TExistingEnt
      >
    >,
  ) {
    this.placeholderID = `$ent.idPlaceholderID$ ${randomNum()}-HoursOfOperation`;
    this.input = action.getInput();
    const updateInput = (d: HoursOfOperationInput) =>
      this.updateInput.apply(this, [d]);

    this.orchestrator = new Orchestrator({
      viewer,
      operation: this.operation,
      tableName: "hours_of_operations",
      key: "id",
      loaderOptions: HoursOfOperation.loaderOptions(),
      builder: this,
      action,
      schema,
      editedFields: () => this.getEditedFields.apply(this),
      updateInput,
      fieldInfo: hoursOfOperationLoaderInfo.fieldInfo,
      ...opts,
    });
  }

  getInput(): TInput {
    return this.input;
  }

  updateInput(input: HoursOfOperationInput) {
    // override input
    this.input = {
      ...this.input,
      ...input,
    };
  }

  deleteInputKey(key: keyof HoursOfOperationInput) {
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

  // this returns the id of the existing ent or the id of the ent that's being created
  async getEntID() {
    if (this.existingEnt) {
      return this.existingEnt.id;
    }
    const edited = await this.orchestrator.getEditedData();
    if (!edited.id) {
      throw new Error(
        `couldn't get the id field. should have been set by 'defaultValueOnCreate'`,
      );
    }
    return edited.id;
  }

  async build(): Promise<Changeset> {
    return this.orchestrator.build();
  }

  async buildWithOptions_BETA(options: ChangesetOptions): Promise<Changeset> {
    return this.orchestrator.buildWithOptions_BETA(options);
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
    return this.orchestrator.editedEnt();
  }

  async editedEntX(): Promise<HoursOfOperation> {
    return this.orchestrator.editedEntX();
  }

  private async getEditedFields(): Promise<Map<string, any>> {
    const input = this.input;

    const result = new Map<string, any>();

    const addField = function (key: string, value: any) {
      if (value !== undefined) {
        result.set(key, value);
      }
    };
    addField("dayOfWeek", input.dayOfWeek);
    addField("dayOfWeekAlt", input.dayOfWeekAlt);
    addField("open", input.open);
    addField("close", input.close);
    return result;
  }

  isBuilder<T extends Ent>(
    node: ID | T | Builder<T, any>,
  ): node is Builder<T, any> {
    return (node as Builder<T, any>).placeholderID !== undefined;
  }

  // get value of dayOfWeek. Retrieves it from the input if specified or takes it from existingEnt
  getNewDayOfWeekValue(): DayOfWeek {
    if (this.input.dayOfWeek !== undefined) {
      return this.input.dayOfWeek;
    }

    if (!this.existingEnt) {
      throw new Error(
        "no value to return for `dayOfWeek` since not in input and no existingEnt",
      );
    }
    return this.existingEnt.dayOfWeek;
  }

  // get value of dayOfWeekAlt. Retrieves it from the input if specified or takes it from existingEnt
  getNewDayOfWeekAltValue(): DayOfWeekAlt | null {
    if (this.input.dayOfWeekAlt !== undefined) {
      return this.input.dayOfWeekAlt;
    }

    return this.existingEnt?.dayOfWeekAlt ?? null;
  }

  // get value of open. Retrieves it from the input if specified or takes it from existingEnt
  getNewOpenValue(): string {
    if (this.input.open !== undefined) {
      return this.input.open;
    }

    if (!this.existingEnt) {
      throw new Error(
        "no value to return for `open` since not in input and no existingEnt",
      );
    }
    return this.existingEnt.open;
  }

  // get value of close. Retrieves it from the input if specified or takes it from existingEnt
  getNewCloseValue(): string {
    if (this.input.close !== undefined) {
      return this.input.close;
    }

    if (!this.existingEnt) {
      throw new Error(
        "no value to return for `close` since not in input and no existingEnt",
      );
    }
    return this.existingEnt.close;
  }
}
