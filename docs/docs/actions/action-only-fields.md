---
sidebar_position: 13
---

# Action Only Fields

Allows [configuring](/docs/ent-schema/actions#actiononlyfields) other fields to be added in the [input](/docs/actions/input#action-input) of an Action.

In the [address example](/docs/actions/triggers#changeset), with the Event schema configured as follows:

```ts title="src/schema/event.ts"
export default class Event extends BaseEntSchema implements Schema {

  actions: Action[] = [
    {
      operation: ActionOperation.Create,
      actionOnlyFields: [
        {
          name: "address",
          type: "Object",
          nullable: true,
          actionName: "CreateAddressAction",
        },
      ],
    },
  ];
}
```

```ts title="src/schema/address.ts"
export default class Address extends BaseEntSchema implements Schema {
  fields: Field[] = [
    StringType({ name: "Street" }),
    StringType({ name: "City" }),
    StringType({ name: "State" }),
    StringType({ name: "ZipCode" }),
    StringType({ name: "Apartment", nullable: true }),
    UUIDType({
      name: "OwnerID",
      index: true, 
      polymorphic: {
        types: [NodeType.Event],
      }
    }),
  ];

  actions: Action[] = [
    {
      operation: ActionOperation.Create,
    },
  ];
}
```

we end up with the following changes:

```ts title="src/ent/event/actions/generated/create_event_action_base.ts"
interface customAddressInput {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  apartment?: string | null;
}

export interface EventCreateInput {
  name: string;
  creatorID: ID | Builder<User>;
  startTime: Date;
  endTime?: Date | null;
  location: string;
  address?: customAddressInput | null;
}
```

```graphql title="src/graphql/schema.gql"
input EventCreateInput {
  name: String!
  creatorID: ID!
  startTime: Time!
  endTime: Time
  eventLocation: String!
  address: AddressEventCreateInput
}

input AddressEventCreateInput {
  street: String!
  city: String!
  state: String!
  zipCode: String!
  apartment: String
}
```

and used as follows:

```ts
  // creates event and associated address at once
  const event = await CreateEventAction.create(vc, {
    name: "fun event",
    creatorID: user.id,
    startTime: yesterday,
    endTime: now,
    location: "location",
    address: {
      streetName: "1 Dr Carlton B Goodlett Pl",
      city: "San Francisco",
      state: "CA",
      zip: "94102",
    },
  }).saveX();
```

Can be called via the GraphQL API similarly.

Note that nothing is automatically done with action only fields. It's up to the developer to use [Triggers](/docs/actions/triggers) to actually process and use them effectively.

It's up to the developer's creativity to find other use cases than what's expressed here.
