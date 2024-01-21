To test interaction btw golang and ts, `npm link` doesn't work because Graphql-js is [particular that the versions of graphql being used are the same](https://github.com/graphql/graphql-js/issues/1091).

Historically, used to just publish garbage versions and install and either overwrite or leave dangling bad versions but can't do that anymore since live.

Then run in `ts` folder:

```shell
tsc && cp -r dist/* ~/code/ent/examples/todo-sqlite/node_modules/@snowtop/snowtop-ts
```

to update the version of the package. Update from todo-sqlite to the right path you want to see being used.

To make local changes:

* in `/ts`, run `tsc && cd dist && npm link @snowtop/ent`
* Test in one of the example folders as follows:

  * `npm link @snowtop/ent`
  * `rm -rf node_modules/graphql`
  * run `tsent codegen` or whatever command to see your changes

Notes for myself:

* `LOCAL_SCRIPT_PATH=true tsent parse_schema` to parse the schema and not print anything
* `LOCAL_SCRIPT_PATH=true tsent print_schema` to print the parsed schema
* `console.error` in ts parse schema code to output to stderr since that's not (currently) captured by go codegen code
