import { EntSchema } from "@snowtop/ent";
import { BaseEntSchema } from "@snowtop/ent";

// doesn't really do anything other than to test what happens with custom
export default class BaseEntTodoSchema extends BaseEntSchema {}

export class TodoEntSchema extends EntSchema {}
