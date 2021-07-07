---
sidebar_position: 8
---

# Validators

Sometimes you need more than [per-field validation](/docs/ent-schema/fields#valid) in an action and Validators associated with an action enables that.

```ts
interface Validator<T extends Ent> {
  // can throw if it wants
  validate(builder: Builder<T>, input: Data): Promise<void> | void;
}
```

Each Validator takes the [Builder](/docs/actions/builder) and the [Input](/docs/actions/input). 

For example, to validate that the start time is before the end time in the example schema

```ts title="src/ent/event/actions/event_validators.ts"
export class EventTimeValidator implements Validator<Event> {
  validate(builder: EventBuilder): void {
    const startTime = builder.getNewStartTimeValue();
    const endTime = builder.getNewEndTimeValue();

    if (!startTime) {
      throw new Error("startTime required");
    }

    if (!endTime) {
      // nothing to do here
      return;
    }

    if (startTime.getTime() > endTime.getTime()) {
      throw new Error("start time cannot be after end time");
    }
  }
}
```

and then update the actions as follows:

```ts title="/src/ent/event/actions/create_event_action.ts"
export default class CreateEventAction extends CreateEventActionBase {

  validators: Validator<Event>[] = [new EventTimeValidator()];
}
```

```ts title="/src/ent/event/actions/edit_event_action.ts"
export default class EditEventAction extends EditEventActionBase {

  validators: Validator<Event>[] = [new EventTimeValidator()];
}
```

so now when creating or editing an event, we'll ensure that the `startTime` (either new or existing) is before the `endTime`.

```ts
  const user = await getUser();

  // throws error
  await CreateEventAction.create(viewer, {
    name: "fun event",
    creatorID: user.id,
    startTime: new Date('December 25, 2021'),
    endTime: new Date('December 25, 2020'),
    location: "location",
  }).saveX();

  // success
  const event = await CreateEventAction.create(viewer, {
    name: "fun event",
    creatorID: user.id,
    startTime: new Date('December 25, 2021'),
    location: "location",
  }).saveX();

  // throws!
  const event2 = await EditEventAction.create(viewer, event, {
    endTime: new Date('December 25, 2020'),
  }).saveX();

```
