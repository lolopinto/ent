import {
  BooleanType,
  GlobalSchema,
  StringType,
  StructType,
} from "@snowtop/ent/schema/";
import { GlobalDeletedEdge } from "@snowtop/ent-soft-delete";

const glo: GlobalSchema = {
  fields: {
    account_prefs: StructType({
      tsType: "AccountPrefs",
      graphQLType: "AccountPrefs",
      fields: {
        finishedNux: BooleanType(),
        enableNotifs: BooleanType(),
        preferredLanguage: StringType(),
      },
    }),
  },
  ...GlobalDeletedEdge,
};
export default glo;
