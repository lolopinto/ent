import { EntSchema } from "@snowtop/ent";
import { BaseEntSchema } from "@snowtop/ent";

// doesn't really do anything other than to test what happens with custom
export default class BaseTodoSchema extends BaseEntSchema {}

export class TodoSchema extends EntSchema {}
