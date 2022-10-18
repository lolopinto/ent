// TODO fix import for polymorphic queries from pattern.
// This should be from src/ent/internal instead of what it generated from @snowtop/ent

// import { ObjectToScopedTodosEdge } from "@snowtop/ent";
// import { Account } from "src/ent/";
import {
  Account,
  ObjectToScopedTodosQuery,
  ObjectToScopedTodosEdge,
} from "src/ent/internal";

export class AccountToScopedTodosEdge extends ObjectToScopedTodosEdge {}

export class AccountToScopedTodosQuery extends ObjectToScopedTodosQuery {
  getSourceLoadEntOptions() {
    return Account.loaderOptions();
  }
}
