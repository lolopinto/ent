// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import { AssocEdgeInputOptions, Ent, ID, Viewer } from "@snowtop/ent";
import {
  Action,
  AssocEdgeOptions,
  Builder,
  Changeset,
  ChangesetOptions,
  Orchestrator,
  OrchestratorOptions,
  WriteOperation,
  saveBuilder,
  saveBuilderX,
} from "@snowtop/ent/action";
import { Account, Todo, Workspace } from "src/ent/";
import { accountLoaderInfo } from "src/ent/generated/loaders";
import { TodoContainerBuilder } from "src/ent/generated/mixins/todo_container/actions/todo_container_builder";
import {
  AccountPrefs,
  AccountState,
  CountryInfo,
  EdgeType,
  NodeType,
} from "src/ent/generated/types";
import schema from "src/schema/account_schema";

export interface AccountInput {
  deletedAt?: Date | null;
  name?: string;
  phoneNumber?: string;
  accountState?: AccountState | null;
  accountPrefs?: AccountPrefs | null;
  accountPrefs3?: AccountPrefs;
  accountPrefsList?: AccountPrefs[] | null;
  credits?: number;
  countryInfos?: CountryInfo[] | null;
  // allow other properties. useful for action-only fields
  [x: string]: any;
}

function randomNum(): string {
  return Math.random().toString(10).substring(2);
}

class Base {
  // @ts-ignore not assigning. need for Mixin
  orchestrator: Orchestrator<Account, any, Viewer>;

  constructor() {}

  isBuilder<T extends Ent>(
    node: ID | T | Builder<T, any>,
  ): node is Builder<T, any> {
    return (node as Builder<T, any>).placeholderID !== undefined;
  }
}

type MaybeNull<T extends Ent> = T | null;
type TMaybleNullableEnt<T extends Ent> = T | MaybeNull<T>;

export class AccountBuilder<
    TInput extends AccountInput = AccountInput,
    TExistingEnt extends TMaybleNullableEnt<Account> = Account | null,
  >
  extends TodoContainerBuilder(Base)
  implements Builder<Account, Viewer, TExistingEnt>
{
  orchestrator: Orchestrator<Account, TInput, Viewer, TExistingEnt>;
  readonly placeholderID: ID;
  readonly ent = Account;
  readonly nodeType = NodeType.Account;
  private input: TInput;
  private m: Map<string, any> = new Map();

  public constructor(
    public readonly viewer: Viewer,
    public readonly operation: WriteOperation,
    action: Action<
      Account,
      Builder<Account, Viewer, TExistingEnt>,
      Viewer,
      TInput,
      TExistingEnt
    >,
    public readonly existingEnt: TExistingEnt,
    opts?: Partial<OrchestratorOptions<Account, TInput, Viewer, TExistingEnt>>,
  ) {
    super();
    this.placeholderID = `$ent.idPlaceholderID$ ${randomNum()}-Account`;
    this.input = action.getInput();
    const updateInput = (d: AccountInput) => this.updateInput.apply(this, [d]);

    this.orchestrator = new Orchestrator({
      viewer,
      operation: this.operation,
      tableName: "accounts",
      key: "id",
      loaderOptions: Account.loaderOptions(),
      builder: this,
      action,
      schema,
      editedFields: () => this.getEditedFields.apply(this),
      updateInput,
      fieldInfo: accountLoaderInfo.fieldInfo,
      ...opts,
    });
  }

  getInput(): TInput {
    return this.input;
  }

  updateInput(input: AccountInput) {
    // override input
    this.input = {
      ...this.input,
      ...input,
    };
  }

  deleteInputKey(key: keyof AccountInput) {
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
  // this gets the inputs that have been written for a given edgeType and operation
  // WriteOperation.Insert for adding an edge and WriteOperation.Delete for deleting an edge
  getEdgeInputData(edgeType: EdgeType, op: WriteOperation) {
    return this.orchestrator.getInputEdges(edgeType, op);
  }

  clearInputEdges(edgeType: EdgeType, op: WriteOperation, id?: ID) {
    this.orchestrator.clearInputEdges(edgeType, op, id);
  }

  addClosedTodosDup(...nodes: (ID | Todo | Builder<Todo, any>)[]): this {
    for (const node of nodes) {
      if (this.isBuilder(node)) {
        this.addClosedTodosDupID(node);
      } else if (typeof node === "object") {
        this.addClosedTodosDupID(node.id);
      } else {
        this.addClosedTodosDupID(node);
      }
    }
    return this;
  }

  addClosedTodosDupID(
    id: ID | Builder<Todo, any>,
    options?: AssocEdgeInputOptions,
  ): this {
    this.orchestrator.addOutboundEdge(
      id,
      EdgeType.AccountToClosedTodosDup,
      NodeType.Todo,
      options,
    );
    return this;
  }

  removeClosedTodosDupID(id: ID, opts?: AssocEdgeOptions): this {
    this.orchestrator.removeOutboundEdge(
      id,
      EdgeType.AccountToClosedTodosDup,
      opts,
    );
    return this;
  }

  removeClosedTodosDup(...nodes: (ID | Todo)[]): this {
    for (const node of nodes) {
      if (typeof node === "object") {
        this.orchestrator.removeOutboundEdge(
          node.id,
          EdgeType.AccountToClosedTodosDup,
        );
      } else {
        this.orchestrator.removeOutboundEdge(
          node,
          EdgeType.AccountToClosedTodosDup,
        );
      }
    }
    return this;
  }

  addCreatedWorkspace(
    ...nodes: (ID | Workspace | Builder<Workspace, any>)[]
  ): this {
    for (const node of nodes) {
      if (this.isBuilder(node)) {
        this.addCreatedWorkspaceID(node);
      } else if (typeof node === "object") {
        this.addCreatedWorkspaceID(node.id);
      } else {
        this.addCreatedWorkspaceID(node);
      }
    }
    return this;
  }

  addCreatedWorkspaceID(
    id: ID | Builder<Workspace, any>,
    options?: AssocEdgeInputOptions,
  ): this {
    this.orchestrator.addOutboundEdge(
      id,
      EdgeType.AccountToCreatedWorkspaces,
      NodeType.Workspace,
      options,
    );
    return this;
  }

  removeCreatedWorkspaceID(id: ID, opts?: AssocEdgeOptions): this {
    this.orchestrator.removeOutboundEdge(
      id,
      EdgeType.AccountToCreatedWorkspaces,
      opts,
    );
    return this;
  }

  removeCreatedWorkspace(...nodes: (ID | Workspace)[]): this {
    for (const node of nodes) {
      if (typeof node === "object") {
        this.orchestrator.removeOutboundEdge(
          node.id,
          EdgeType.AccountToCreatedWorkspaces,
        );
      } else {
        this.orchestrator.removeOutboundEdge(
          node,
          EdgeType.AccountToCreatedWorkspaces,
        );
      }
    }
    return this;
  }

  addOpenTodosDup(...nodes: (ID | Todo | Builder<Todo, any>)[]): this {
    for (const node of nodes) {
      if (this.isBuilder(node)) {
        this.addOpenTodosDupID(node);
      } else if (typeof node === "object") {
        this.addOpenTodosDupID(node.id);
      } else {
        this.addOpenTodosDupID(node);
      }
    }
    return this;
  }

  addOpenTodosDupID(
    id: ID | Builder<Todo, any>,
    options?: AssocEdgeInputOptions,
  ): this {
    this.orchestrator.addOutboundEdge(
      id,
      EdgeType.AccountToOpenTodosDup,
      NodeType.Todo,
      options,
    );
    return this;
  }

  removeOpenTodosDupID(id: ID, opts?: AssocEdgeOptions): this {
    this.orchestrator.removeOutboundEdge(
      id,
      EdgeType.AccountToOpenTodosDup,
      opts,
    );
    return this;
  }

  removeOpenTodosDup(...nodes: (ID | Todo)[]): this {
    for (const node of nodes) {
      if (typeof node === "object") {
        this.orchestrator.removeOutboundEdge(
          node.id,
          EdgeType.AccountToOpenTodosDup,
        );
      } else {
        this.orchestrator.removeOutboundEdge(
          node,
          EdgeType.AccountToOpenTodosDup,
        );
      }
    }
    return this;
  }

  addWorkspace(...nodes: (ID | Workspace | Builder<Workspace, any>)[]): this {
    for (const node of nodes) {
      if (this.isBuilder(node)) {
        this.addWorkspaceID(node);
      } else if (typeof node === "object") {
        this.addWorkspaceID(node.id);
      } else {
        this.addWorkspaceID(node);
      }
    }
    return this;
  }

  addWorkspaceID(
    id: ID | Builder<Workspace, any>,
    options?: AssocEdgeInputOptions,
  ): this {
    this.orchestrator.addOutboundEdge(
      id,
      EdgeType.AccountToWorkspaces,
      NodeType.Workspace,
      options,
    );
    return this;
  }

  removeWorkspaceID(id: ID, opts?: AssocEdgeOptions): this {
    this.orchestrator.removeOutboundEdge(
      id,
      EdgeType.AccountToWorkspaces,
      opts,
    );
    return this;
  }

  removeWorkspace(...nodes: (ID | Workspace)[]): this {
    for (const node of nodes) {
      if (typeof node === "object") {
        this.orchestrator.removeOutboundEdge(
          node.id,
          EdgeType.AccountToWorkspaces,
        );
      } else {
        this.orchestrator.removeOutboundEdge(
          node,
          EdgeType.AccountToWorkspaces,
        );
      }
    }
    return this;
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

  async editedEnt(): Promise<Account | null> {
    return this.orchestrator.editedEnt();
  }

  async editedEntX(): Promise<Account> {
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
    addField("deleted_at", input.deletedAt);
    addField("Name", input.name);
    addField("PhoneNumber", input.phoneNumber);
    addField("accountState", input.accountState);
    addField("accountPrefs", input.accountPrefs);
    addField("accountPrefs3", input.accountPrefs3);
    addField("accountPrefsList", input.accountPrefsList);
    addField("credits", input.credits);
    addField("country_infos", input.countryInfos);
    return result;
  }

  isBuilder<T extends Ent>(
    node: ID | T | Builder<T, any>,
  ): node is Builder<T, any> {
    return (node as Builder<T, any>).placeholderID !== undefined;
  }

  // get value of deleted_at. Retrieves it from the input if specified or takes it from existingEnt
  getNewDeletedAtValue(): Date | null | undefined {
    return this.input.deletedAt;
  }

  // get value of Name. Retrieves it from the input if specified or takes it from existingEnt
  getNewNameValue(): string {
    if (this.input.name !== undefined) {
      return this.input.name;
    }

    if (!this.existingEnt) {
      throw new Error(
        "no value to return for `name` since not in input and no existingEnt",
      );
    }
    return this.existingEnt.name;
  }

  // get value of PhoneNumber. Retrieves it from the input if specified or takes it from existingEnt
  getNewPhoneNumberValue(): string | null {
    if (this.input.phoneNumber !== undefined) {
      return this.input.phoneNumber;
    }

    if (!this.existingEnt) {
      throw new Error(
        "no value to return for `phoneNumber` since not in input and no existingEnt",
      );
    }
    return this.existingEnt.phoneNumber;
  }

  // get value of accountState. Retrieves it from the input if specified or takes it from existingEnt
  getNewAccountStateValue(): AccountState | null {
    if (this.input.accountState !== undefined) {
      return this.input.accountState;
    }

    return this.existingEnt?.accountState ?? null;
  }

  // get value of accountPrefs. Retrieves it from the input if specified or takes it from existingEnt
  getNewAccountPrefsValue(): AccountPrefs | null {
    if (this.input.accountPrefs !== undefined) {
      return this.input.accountPrefs;
    }

    return this.existingEnt?.accountPrefs ?? null;
  }

  // get value of accountPrefs3. Retrieves it from the input if specified or takes it from existingEnt
  getNewAccountPrefs3Value(): AccountPrefs | null {
    if (this.input.accountPrefs3 !== undefined) {
      return this.input.accountPrefs3;
    }

    if (!this.existingEnt) {
      throw new Error(
        "no value to return for `accountPrefs3` since not in input and no existingEnt",
      );
    }
    return this.existingEnt.accountPrefs3;
  }

  // get value of accountPrefsList. Retrieves it from the input if specified or takes it from existingEnt
  getNewAccountPrefsListValue(): AccountPrefs[] | null {
    if (this.input.accountPrefsList !== undefined) {
      return this.input.accountPrefsList;
    }

    return this.existingEnt?.accountPrefsList ?? null;
  }

  // get value of credits. Retrieves it from the input if specified or takes it from existingEnt
  getNewCreditsValue(): number | null {
    if (this.input.credits !== undefined) {
      return this.input.credits;
    }

    if (!this.existingEnt) {
      throw new Error(
        "no value to return for `credits` since not in input and no existingEnt",
      );
    }
    return this.existingEnt.credits;
  }

  // get value of country_infos. Retrieves it from the input if specified or takes it from existingEnt
  getNewCountryInfosValue(): CountryInfo[] | null {
    if (this.input.countryInfos !== undefined) {
      return this.input.countryInfos;
    }

    return this.existingEnt?.countryInfos ?? null;
  }
}
