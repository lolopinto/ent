import {
  ActionOperation,
  EntSchema,
  EnumType,
  StringType,
  UUIDType,
} from "@snowtop/ent";
import { GeographyPointType, pointGISTIndex } from "@snowtop/ent-postgis";

const PlaceSchema = new EntSchema({
  fields: {
    name: StringType(),
    slug: StringType({ unique: true }),
    description: StringType({ nullable: true }),
    website: StringType({ nullable: true }),
    category: EnumType({
      tsType: "PlaceCategory",
      graphQLType: "PlaceCategory",
      values: ["coffee", "park", "museum", "restaurant"],
      disableUnknownType: true,
    }),
    creatorID: UUIDType({
      fieldEdge: {
        schema: "User",
        inverseEdge: "createdPlaces",
      },
      defaultToViewerOnCreate: true,
    }),
    location: GeographyPointType(),
  },

  indices: [pointGISTIndex("places_location_gist", "location")],

  actions: [
    {
      operation: ActionOperation.Create,
      excludedFields: ["creatorID"],
    },
    {
      operation: ActionOperation.Edit,
    },
    {
      operation: ActionOperation.Delete,
      hideFromGraphQL: true,
    },
  ],
});

export default PlaceSchema;
