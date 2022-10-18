import {
  Account,
  ObjectToScopedTodosEdge,
  ObjectToScopedTodosQuery,
} from "src/ent/internal";

export class AccountToScopedTodosEdge extends ObjectToScopedTodosEdge {}

export class AccountToScopedTodosQuery extends ObjectToScopedTodosQuery {
  getSourceLoadEntOptions() {
    return Account.loaderOptions();
  }
}
