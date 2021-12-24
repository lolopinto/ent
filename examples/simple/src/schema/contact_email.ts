import {
  Schema,
  Action,
  ActionOperation,
  Field,
  BaseEntSchema,
  StringType,
  UUIDType,
} from "@snowtop/ent/schema/";
import { EmailType } from "@snowtop/ent-email";
import { getLoaderOptions } from "../ent/generated/loadAny";

export default class ContactEmail extends BaseEntSchema implements Schema {
  fields: Field[] = [
    EmailType({ name: "emailAddress" }),
    StringType({ name: "label" }),
    UUIDType({
      name: "contactID",
      fieldEdge: {
        schema: "Contact",
        enforceSchema: true,
        loadRowByType: getLoaderOptions,
      },
    }),
  ];

  actions: Action[] = [
    {
      operation: ActionOperation.Mutations,
    },
  ];
}
