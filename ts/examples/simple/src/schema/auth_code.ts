import { BaseEntSchema, Field, StringType, UUIDType } from "@lolopinto/ent";
import { EmailType } from "@lolopinto/ent-email";

// no graphql object needed here
// no grapqhl action needed here
export default class AuthCode extends BaseEntSchema {
  fields: Field[] = [
    StringType({ name: "code" }),
    UUIDType({ name: "userID", foreignKey: ["User", "id"] }),
    EmailType({ name: "emailAddress" }),
  ];
}
