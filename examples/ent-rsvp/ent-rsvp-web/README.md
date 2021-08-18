## Getting Started

This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

It's currently hosted in [production](https://ent-rsvp-static-site.onrender.com/).

To update `schema.graphql` anytime backend graphql changes, run:

```shell
npm run update-graphql
```

This depends on [get-graphql-schema](https://github.com/prisma-labs/get-graphql-schema) which you need to have installed via

```shell
npm install -g get-graphql-schema
```

Run `npm run relay` to generate [Relay](https://relay.dev/) artifacts when things change.

Run `npm run dev` to start the React app.

Run `npm run build` to build to get a static output.
