import {
  ActionOperation,
  EntSchema,
  IntegerType,
  StringType,
  UUIDType,
} from "@snowtop/ent";

const PlaceReviewSchema = new EntSchema({
  fields: {
    placeID: UUIDType({
      fieldEdge: {
        schema: "Place",
        inverseEdge: "reviews",
      },
    }),
    reviewerID: UUIDType({
      fieldEdge: {
        schema: "User",
        inverseEdge: "placeReviews",
      },
      defaultToViewerOnCreate: true,
    }),
    rating: IntegerType({
      min: 1,
      max: 5,
    }),
    body: StringType({ nullable: true }),
  },

  actions: [
    {
      operation: ActionOperation.Create,
      excludedFields: ["reviewerID"],
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

export default PlaceReviewSchema;
