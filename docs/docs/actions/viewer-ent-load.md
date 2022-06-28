---
sidebar_position: 15
---

# Viewer For Ent Load

After an action is performed, often the object is reloaded as follows:

```ts
const user = await CreateUserAction.create(vc, input).saveX();
```

There's usually 2 privacy checks performed:

* before the write - can viewer perform action
* loading the object back - can viewer see this ent

Usually, these are 2 different policies. In most scenarios, this works fine and nothing needs to be done.

However, in some scenarios, the default viewer can create the object but not necessarily read it afterwards. For example, creating an account on a service while logged out.

```ts title="src/ent/user/actions/create_user_action.ts"

export default class CreateUserAction extends CreateUserActionBase {
  getPrivacyPolicy() {
    return AlwaysAllowPrivacyPolicy;
  }
}
```

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

Here, the `CreateUserAction` Policy allows a [Logged Out Viewer](/docs/core-concepts/viewer#loggedoutviewer) to create the User but the `User` Ent policy says only the Viewer or their friends can see the user.

```ts
// this will throw an error:
// Error:    was able to create ent but not load it
const user = await CreateUserAction.create(new LoggedOutViewer(), input).saveX();
```

To handle this error, the `Action` interface supports the following optional method:

```ts
interface Action<T extends Ent> {
  viewerForEntLoad?(data: Data): Viewer | Promise<Viewer>;
}
```

If provided, this takes the row returned from the database (currently, there's a `RETURN *`) as part of the `INSERT` or `UPDATE` queries and passes that to `viewerForEntLoad` which can then return a different Viewer to use to load the Ent.

In this case, we'll update `CreateUserAction` as follows:

```ts title="src/ent/user/actions/create_user_action.ts"

export default class CreateUserAction extends CreateUserActionBase {
  getPrivacyPolicy() {
    return AlwaysAllowPrivacyPolicy;
  }

  viewerForEntLoad(data: Data) {
    return new IDViewer(data.id);
  }
}
```

This creates a new [IDViewer](/docs/core-concepts/viewer#idviewer) to use for the 2nd check and now this works:

```ts
//success!
const user = await CreateUserAction.create(new LoggedOutViewer(), input).saveX();
```
