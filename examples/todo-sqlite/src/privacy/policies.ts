import {
  Allow,
  AllowIfViewerIsEntPropertyRule,
  AllowIfViewerRule,
  AlwaysDenyRule,
  Ent,
  PrivacyPolicy,
  PrivacyResult,
  Skip,
  Viewer,
} from "@snowtop/ent";
import type { Todo } from "src/ent/internal";

// SystemViewer is only constructed in code, for side effects that a trigger
// performs on behalf of an already-authorized action, e.g. updating the
// creator's account when the assignee completes a todo or paying out a
// bounty. It is never derived from a request.
export class SystemViewer implements Viewer {
  readonly viewerID = null;

  async viewer() {
    return null;
  }

  instanceKey(): string {
    return "todo-system-viewer";
  }
}

export const AllowIfSystemViewerRule = {
  async apply(v: Viewer, _ent?: Ent): Promise<PrivacyResult> {
    return v instanceof SystemViewer ? Allow() : Skip();
  },
};

// only the todo's creator. on create, this is checked against the creatorId in
// the input
export const AllowIfTodoCreatorPrivacyPolicy: PrivacyPolicy<Todo> = {
  rules: [
    new AllowIfViewerIsEntPropertyRule<Todo>("creatorId"),
    AlwaysDenyRule,
  ],
};

// the todo's creator or assignee
export const AllowIfTodoOwnerPrivacyPolicy: PrivacyPolicy<Todo> = {
  rules: [
    new AllowIfViewerIsEntPropertyRule<Todo>("creatorId"),
    new AllowIfViewerIsEntPropertyRule<Todo>("assigneeId"),
    AlwaysDenyRule,
  ],
};

// the account itself, or a trigger acting for an authorized parent action
export const AllowIfAccountOrSystemPrivacyPolicy: PrivacyPolicy = {
  rules: [AllowIfViewerRule, AllowIfSystemViewerRule, AlwaysDenyRule],
};

export const AllowIfSystemPrivacyPolicy: PrivacyPolicy = {
  rules: [AllowIfSystemViewerRule, AlwaysDenyRule],
};
