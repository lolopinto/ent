// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

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
import { Address } from "../..";
import schema from "../../../schema/address";

export interface AddressInput {
  streetName?: string;
  city?: string;
  state?: string;
  zip?: string;
  apartment?: string | null;
  country?: string;
}

export interface AddressAction extends Action<Address> {
  getInput(): AddressInput;
}

function randomNum(): string {
  return Math.random().toString(10).substring(2);
}

export class AddressBuilder implements Builder<Address> {
  orchestrator: Orchestrator<Address>;
  readonly placeholderID: ID;
  readonly ent = Address;
  private input: AddressInput;

  public constructor(
    public readonly viewer: Viewer,
    public readonly operation: WriteOperation,
    action: AddressAction,
    public readonly existingEnt?: Address | undefined,
  ) {
    this.placeholderID = `$ent.idPlaceholderID$ ${randomNum()}-Address`;
    this.input = action.getInput();

    this.orchestrator = new Orchestrator({
      viewer: viewer,
      operation: this.operation,
      tableName: "addresses",
      key: "id",
      loaderOptions: Address.loaderOptions(),
      builder: this,
      action: action,
      schema: schema,
      editedFields: () => {
        return this.getEditedFields.apply(this);
      },
    });
  }

  getInput(): AddressInput {
    return this.input;
  }

  updateInput(input: AddressInput) {
    // override input
    this.input = {
      ...this.input,
      ...input,
    };
  }

  async build(): Promise<Changeset<Address>> {
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

  async editedEnt(): Promise<Address | null> {
    return await this.orchestrator.editedEnt();
  }

  async editedEntX(): Promise<Address> {
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
    addField("street_name", fields.streetName);
    addField("city", fields.city);
    addField("state", fields.state);
    addField("zip", fields.zip);
    addField("apartment", fields.apartment);
    addField("country", fields.country);
    return result;
  }

  isBuilder(node: ID | Ent | Builder<Ent>): node is Builder<Ent> {
    return (node as Builder<Ent>).placeholderID !== undefined;
  }

  // get value of street_name. Retrieves it from the input if specified or takes it from existingEnt
  getNewStreetNameValue(): string | undefined {
    return this.input.streetName || this.existingEnt?.streetName;
  }

  // get value of city. Retrieves it from the input if specified or takes it from existingEnt
  getNewCityValue(): string | undefined {
    return this.input.city || this.existingEnt?.city;
  }

  // get value of state. Retrieves it from the input if specified or takes it from existingEnt
  getNewStateValue(): string | undefined {
    return this.input.state || this.existingEnt?.state;
  }

  // get value of zip. Retrieves it from the input if specified or takes it from existingEnt
  getNewZipValue(): string | undefined {
    return this.input.zip || this.existingEnt?.zip;
  }

  // get value of apartment. Retrieves it from the input if specified or takes it from existingEnt
  getNewApartmentValue(): string | null | undefined {
    return this.input.apartment || this.existingEnt?.apartment;
  }

  // get value of country. Retrieves it from the input if specified or takes it from existingEnt
  getNewCountryValue(): string | undefined {
    return this.input.country || this.existingEnt?.country;
  }
}
