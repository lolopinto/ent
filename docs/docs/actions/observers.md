---
sidebar_position: 10
---

# Observers

Observers allow for coordinating changes that shouldn't be made within the same transaction as the write.

This is where things that hit external services should be placed. For example, sending an SMS, sending a confirmation email etc.

As of right now, errors in Observers don't fail the transaction and it's up to the developer to handle them as they see fit. In the future, we may add the concept of *Critical Observers* which are expected to be rare instances when a failure within an Observer can roll back the transaction.

## Observer Interface

```ts
export interface Observer<T extends Ent> {
  observe(builder: Builder<T>, input: Data): void | Promise<void>;
}
```

## Example

Here's an example in action:

```ts title="src/ent/user/actions/create_user_action.ts"
export default class CreateUserAction extends CreateUserActionBase {

  observers = [
    {
      observe: (_builder: UserBuilder, input: UserCreateInput): void => {
        let email = input.emailAddress;
        let firstName = input.firstName;
        FakeComms.send({
          from: "noreply@foo.com",
          to: email,
          subject: `Welcome, ${firstName}!`,
          body: `Hi ${firstName}, thanks for joining fun app!`,
          mode: Mode.EMAIL,
        });
      },
    },
    new EntCreationObserver<User>(),
  ];
}

// reusable observer that can be used across all objects
export class EntCreationObserver<T extends Ent> {
  async observe(builder: Builder<T>) {
    if (!builder.editedEnt) {
      return;
    }
    let ent = await builder.editedEnt();
    if (ent) {
      FakeLogger.log(`ent ${builder.ent.name} created with id ${ent.id}`);
    }
  }
}
```

We have 2 observers that are run when a User is created:

* Confirmation email being sent to user welcoming them
* Ent is logged as being created
