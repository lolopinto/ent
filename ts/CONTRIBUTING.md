To test interaction btw golang and ts, `npm link` doesn't work because Graphql-js is [particular that the versions of graphql being used are the same](https://github.com/graphql/graphql-js/issues/1091).

Historically, used to just publish garbage versions and install and either overwrite or leave dangling bad versions but can't do that anymore since live.

Then run in `ts` folder:

```shell
tsc && cp -r dist/* ~/code/ent/examples/todo-sqlite/node_modules/@snowtop/snowtop-ts
```

to update the version of the package. Update from todo-sqlite to the right path you want to see being used.