---
sidebar_position: 14
---

# Permissions

To control who can perform an action, a [Privacy Policy](/docs/core-concepts/privacy-policy) is used.

The [Default Privacy Policy](/docs/actions/action#default-privacy-policy) is that any logged in user can perform the action. This doesn't work for all scenarios so naturally, this can be overriden and it's respected *everywhere*.

## Create Action Example

For example, to specify who can [create an event](/docs/actions/create-action), it can be configured as follows:

```ts title="src/ent/event/actions/create_event_action.ts"

export default class CreateEventAction extends CreateEventActionBase {
  getPrivacyPolicy(): PrivacyPolicy {
    return {
      rules: [
        new AllowIfViewerEqualsRule(this.input.creatorID),
        AlwaysDenyRule,
      ],
    };
  }
}
```

This specifies that the viewer is allowed to create the event assuming the `viewerID` is equal to the `creatorID` in the [input](/docs/actions/input).

Another way to do this specific scenario is to keep the default privacy policy and to use a [validator](/docs/actions/validators) to enforce this.

## Edit Action Example

For example, to specify who can [edit an event](/docs/actions/edit-action), it can be configured as follows:

```ts title="src/ent/event/actions/edit_event_action.ts"

export default class EditEventAction extends EditEventActionBase {
  getPrivacyPolicy(): PrivacyPolicy {
    return {
      rules: [new AllowIfViewerIsRule("creatorID"), AlwaysDenyRule],
    };
  }
}
```

This specifies that the viewer is allowed to edit the event assuming the `viewerID` is equal to the `creatorID` in the ent.

## Delete Action Example

For example, to specify who can [delete an event](/docs/actions/delete-action), it can be configured as follows:

```ts title="src/ent/event/actions/delete_event_action.ts"

export default class DeleteEventAction extends DeleteEventActionBase {
  getPrivacyPolicy(): PrivacyPolicy {
    return {
      rules: [new AllowIfViewerIsRule("creatorID"), AlwaysDenyRule],
    };
  }
}
```

This specifies that the viewer is allowed to delete the event assuming the `viewerID` is equal to the `creatorID` in the ent.

Note that in this example, the policy to edit and delete is the same. Can be refactored into a common class that's shared especially if it's a complicated policy.

## API

The interface for [PrivacyPolicyRule](/docs/core-concepts/privacy-policy#privacypolicyrule) is shown below again:

```ts
interface PrivacyPolicyRule {
  apply(v: Viewer, ent?: Ent): Promise<PrivacyResult>;
}
```

Note that the 2nd parameter here is optional. For create actions, nothing is passed for the `ent` parameter. However, for edit and delete actions, the existing ent is passed a second parameter.
