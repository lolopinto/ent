import {
  ActionOperation,
  EntSchema,
  StringType,
  UUIDType,
} from "@snowtop/ent/schema/";
import { PhoneNumberType } from "@snowtop/ent-phonenumber";
import { getLoaderInfoFromSchema } from "../ent/generated/loaders";

const ContactPhoneNumber = new EntSchema({
  fields: {
    phoneNumber: PhoneNumberType(),
    label: StringType(),
    contactID: UUIDType({
      fieldEdge: {
        schema: "Contact",
        enforceSchema: true,
        getLoaderInfoFromSchema: getLoaderInfoFromSchema,
      },
    }),
  },

  actions: [
    {
      operation: ActionOperation.Mutations,
    },
  ],
});
export default ContactPhoneNumber;
