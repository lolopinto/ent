This builds a simple event rsvp website using the framework.

The front end code is located in the `ent-rsvp-web` folder and the backend code which uses the `Ent` framework is in the `backend` folder.

# Frontend
Uses [NextJs](https://nextjs.org/) and [Relay](https://relay.dev/).

Currently using an old version of Relay so don't have the recent [bells and whistles](https://relay.dev/blog/2021/03/09/introducing-relay-hooks).

# Backend
There are 8 different node types supported:
* `User`: User object. Represents someone who can create an account and login
* `Event`: Represents an event such as a wedding
* `EventActivity`: Represents activities associated with an Event such as 
  - welcome dinner
  - reception
  - closing brunch
* `GuestGroup`: Represents one or more people invited to an event e.g. one person, a couple, family etc.
* `Guest`: Represents a guest invited. Each Guest is part of a Guest Group.
* `Address`: Represents the address associated with an activity
* `GuestData`: Represents the data associated with a Guest's RSVP to an event activity.
* `AuthCode`: represents the auth code which is pregenerated for each guest which allows a guest to login and rsvp for everyone in their party.

Diving into the code here shows usage of all the supprted features of the Ent framework. For example:

* [Groups and Edges](https://github.com/lolopinto/ent/blob/main/examples/ent-rsvp/backend/src/schema/event_activity.ts#L48-L97)
* [File Uploads](https://github.com/lolopinto/ent/blob/main/examples/ent-rsvp/backend/src/graphql/mutations/import_guests.ts)
* [Custom](https://github.com/lolopinto/ent/blob/main/examples/ent-rsvp/backend/src/graphql/resolvers/event.ts) [Query](https://github.com/lolopinto/ent/blob/main/examples/ent-rsvp/backend/src/graphql/resolvers/viewer.ts)
* [Custom Mutation](https://github.com/lolopinto/ent/blob/main/examples/ent-rsvp/backend/src/graphql/mutations/auth/auth.ts)
* Custom relatively complex Privacy policies:
  - [EventActivity](https://github.com/lolopinto/ent/blob/main/examples/ent-rsvp/backend/src/ent/event_activity.ts#L22)
  - [GuestGroup](https://github.com/lolopinto/ent/blob/main/examples/ent-rsvp/backend/src/ent/guest_group.ts#L30)
  - [Guest](https://github.com/lolopinto/ent/blob/main/examples/ent-rsvp/backend/src/ent/guest.ts#L12)
  - [EditEventActivityRsvpStatusAction](https://github.com/lolopinto/ent/blob/main/examples/ent-rsvp/backend/src/ent/event_activity/actions/edit_event_activity_rsvp_status_action.ts#L25-L46)
* Custom Edge Data:
  - [Event Activity to Atttending Edge](https://github.com/lolopinto/ent/blob/main/examples/ent-rsvp/backend/src/ent/event_activity/query/event_activity_to_attending_query.ts#L8) for dietary restrictions
  - [Guest to Attending Activities Edge](https://github.com/lolopinto/ent/blob/main/examples/ent-rsvp/backend/src/ent/guest/query/guest_to_attending_events_query.ts#L8)
* [Polymorphic field](https://github.com/lolopinto/ent/blob/main/examples/ent-rsvp/backend/src/schema/address.ts#L21)
* [Unique Constraint multiple fields](https://github.com/lolopinto/ent/blob/main/examples/ent-rsvp/backend/src/schema/auth_code.ts#L34)
* Action Only Fields:
  - [EventActivity creating Address](https://github.com/lolopinto/ent/blob/main/examples/ent-rsvp/backend/src/schema/event.ts#L24) seen in use at https://github.com/lolopinto/ent/blob/main/examples/ent-rsvp/backend/src/ent/event_activity/actions/create_event_activity_action.ts#L23-L33
  - [GuestGroup creating multiple Guests](https://github.com/lolopinto/ent/blob/main/examples/ent-rsvp/backend/src/schema/guest_group.ts#L22) seen in use at https://github.com/lolopinto/ent/blob/main/examples/ent-rsvp/backend/src/ent/guest_group/actions/create_guest_group_action.ts#L49-L68 
* [Schema hidden from GraphQL](https://github.com/lolopinto/ent/blob/main/examples/ent-rsvp/backend/src/schema/guest_data.ts#L11)
* [Storing an id the data field of an edge to create a 3-way edge](https://github.com/lolopinto/ent/blob/main/examples/ent-rsvp/backend/src/ent/event_activity/actions/edit_event_activity_rsvp_status_action.ts#L49-L83)

The site is currently available live at https://ent-rsvp-static-site.onrender.com/.

It currently doesn't send an email to guests so the login link isn't available for anyone without database access.

## Running locally
* Create database via `createdb ent-rsvp`
* Run `npm run upgrade` to upgrade the database
* Create `.env.local` with `NEXT_PUBLIC_RELAY_ENDPOINT=http://localhost:4000/graphql`
* Run `npm run dev` from `ent-rsvp-web` for the web
* Run `npm run start-fast` from `backend` to start the web server.
