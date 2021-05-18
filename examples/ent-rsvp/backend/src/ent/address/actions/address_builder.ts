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
import schema from "src/schema/address";
import { Address } from "src/ent/";

export interface AddressInput {
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  apartment?: string | null;
  ownerID?: ID | Builder<Ent>;
  ownerType?: string;
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
    addField("Street", fields.street);
    addField("City", fields.city);
    addField("State", fields.state);
    addField("ZipCode", fields.zipCode);
    addField("Apartment", fields.apartment);
    addField("OwnerID", fields.ownerID);
    addField("OwnerType", fields.ownerType);
    return result;
  }

  isBuilder(node: ID | Ent | Builder<Ent>): node is Builder<Ent> {
    return (node as Builder<Ent>).placeholderID !== undefined;
  }
}
