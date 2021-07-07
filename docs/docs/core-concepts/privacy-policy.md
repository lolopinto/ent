---
sidebar_position: 4
---

# Privacy Policy

The `PrivacyPolicy` is used to apply permission checks on an object. It's used in [Ents](/docs/core-concepts/ent) and [Actions](/docs/actions/action).

```ts
interface PrivacyPolicyRule {
  apply(v: Viewer, ent?: Ent): Promise<PrivacyResult>;
}

interface PrivacyPolicy {
  rules: PrivacyPolicyRule[];
}
```

Each `PrivacyPolicy` defines a list of **ordered** rules in terms of priority.

## PrivacyPolicyRule

Each rule takes a `Viewer` and an `Ent` (depending on where it's being called) and returns one of three results:

* `Allow()`
* `Deny()`
* `Skip()`

### Allow

When a rule returns `Allow()`, it's saying that it has enough information to pass this check.

### Deny

When a rule returns `Deny()`, it's saying that it has enough information to deny this check

### Skip

When a rule returns `Skip()`, it's saying that it doesn't have enough information to make a decision, and you should go to the next rule.

Guidelines:

* The last rule in a policy should *always* allow or *always* deny. It shouldn't be ambiguous what the result is.
* If not an always allow or always deny rule, a rule should return
  * `Allow()` or `Skip()` or
  * `Deny()` or `Skip()`
* For readability and reusability purposes, rules should be broken down into the simplest reusable components and not try to do too much.

## AlwaysAllowPrivacyPolicy

This is a simple policy that comes with the framework that has only one rule: `AlwaysAllowRule`. This *always* passes the privacy check

## AlwaysDenyPrivacyPolicy

This is a simple policy that comes with the framework that has only one rule: `AlwaysDenyRule`. This *always* denies the privacy check

## Examples

### user private social network

Consider a private social network where a user can only see another user if they're friends (ignoring the issue of how they become friends), here's what a simple privacy policy looks like:

```ts title="src/ent/user.ts"
export class User extends UserBase {
  privacyPolicy: PrivacyPolicy = {
    rules: [
      AllowIfViewerRule,
      new AllowIfViewerInboundEdgeExistsRule(EdgeType.UserToFriends),
      AlwaysDenyRule,
    ],
  };
}
```

This has 3 rules:

* `AllowIfViewerRule`: this checks that the id of the `Viewer` is equal to the id of the ent. If so, ent is visible.
* `AllowIfViewerInboundEdgeExistsRule`: this checks that an edge exists from viewer's id to the id of the ent. If so, ent is visible.
* `AlwaysDenyRule`: otherwise, ent isn't visible.

### contact management system

Or a User having a list of contacts and you want to ensure that only the owner of the contacts can see them. A simple privacy policy looks like:

```ts title="src/ent/contact.ts"
export class Contact extends ContactBase {
  privacyPolicy: PrivacyPolicy = {
    rules: [new AllowIfViewerIsRule("userID"), AlwaysDenyRule],
  };
}
```

This has 2 rules:

* `AllowIfViewerIsRule`: this checks that the id of the `Viewer` is equal to the field `userID` of the ent. If so, ent is visible.
* `AlwaysDenyRule`: otherwise, ent isn't visible.

### events based system

Event based system with guests.

```ts title="src/ent/guest.ts"
export class Guest extends GuestBase {
  privacyPolicy: PrivacyPolicy = {
    rules: [
      // guest can view self
      AllowIfViewerRule,
      // can view guest group if creator of event
      new AllowIfEventCreatorRule(this.eventID),
      new AllowIfGuestInSameGuestGroupRule(),
      AlwaysDenyRule,
    ],
  };
}
```

This has 4 rules:

* `AllowIfViewerRule`:  this checks that the id of the `Viewer` is equal to the id of the ent. If so, ent is visible.
* `AllowIfEventCreatorRule`: custom rule. Guest is visible if viewer is event creator
* `AllowIfGuestInSameGuestGroupRule`: custom rule. Guest is visible if viewer and guest are part of a group invited together e.g. +1 for a wedding
* `AlwaysDenyRule`: otherwise, ent isn't visible.

### social media with blocking

```ts title="src/ent/user.ts"
export class User extends UserBase {
  privacyPolicy: PrivacyPolicy = {
    rules: [
      AllowIfViewerRule,
      new DenyIfViewerOutboundEdgeExistsRule(EdgeType.UserToBlocks),
      AlwaysAllowRule,
    ],
  };
}
```

This has 3 rules:

* `AllowIfViewerRule`:  this checks that the id of the `Viewer` is equal to the id of the ent. If so, ent is visible.
* `DenyIfViewerOutboundEdgeExistsRule`: denies if there's an edge from ent to viewer e.g. has the user (the ent we're trying to load) blocked the viewer, if so, ent is not visible
* `AlwaysAllowRule`: otherwise, ent is visible.

In this scenario, we're denying early if possible and then ending open

### rbac

Or in a contrived simplified [RBAC](https://en.wikipedia.org/wiki/Role-based_access_control) system, something like:

```ts title="src/privacy/roles.ts"
enum Role {
  ///....
}
export class AllowIfViewerHasRoleRule {
  constructor(private role:Role) {}

  async apply(v: Viewer, ent?: Ent): Promise<PrivacyResult> {
    if (!v.viewerID) {
      return Skip();
    }
    const userRole = await fetchRole(v.viewerID);
    if (userRole === this.role) {
      return Allow();
    }
    return Skip();
  }
}

export class AllowIfViewerHasRolePrivacyPolicy {
  constructor(private role:Role) {}

  rules: PrivacyPolicyRule[] = [
    new AllowIfViewerHasRoleRule(this.role),
    AlwaysDenyRule,
  ];
}
```

```ts title="src/ent/post.ts"
export class Post extends PostBase {
  privacyPolicy: PrivacyPolicy = new AllowIfViewerHasRolePrivacyPolicy(Role.Post);
}
```

```ts title="src/ent/blog.ts"
export class Blog extends BlogBase {
  privacyPolicy: PrivacyPolicy = new AllowIfViewerHasRolePrivacyPolicy(Role.PublishBlog);
}
```
