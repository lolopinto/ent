import { gqlQuery } from "@snowtop/ent/graphql";

export class DecoratedRuntimeResolver {
  async runtimeReady(): Promise<boolean> {
    return true;
  }
}

gqlQuery({
  class: "DecoratedRuntimeResolver",
  name: "decoratedRuntimeReady",
  type: Boolean,
  async: true,
})(
  DecoratedRuntimeResolver.prototype,
  "runtimeReady",
  Object.getOwnPropertyDescriptor(
    DecoratedRuntimeResolver.prototype,
    "runtimeReady",
  ),
);
