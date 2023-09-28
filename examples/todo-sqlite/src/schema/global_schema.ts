import {
  BooleanType,
  GlobalSchema,
  StringType,
  StructType,
  StructTypeAsList,
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
    countries: StructTypeAsList({
      tsType: "Country",
      graphQLType: "Country",
      fields: {
        name: StringType(),
        code: StringType(),
        capital: StructType({
          tsType: "CountryCapital",
          graphQLType: "CountryCapital",
          fields: {
            name: StringType(),
            population: StringType(),
          },
        }),
      },
    }),
  },
  ...GlobalDeletedEdge,
};
export default glo;
