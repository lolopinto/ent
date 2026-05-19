import { GraphQLEnumType } from "graphql";

export const ImportedDisciplineType = new GraphQLEnumType({
  name: "ImportedDiscipline",
  values: {
    JUMPING: {
      value: "jumping",
    },
    DRESSAGE: {
      value: "dressage",
    },
  },
});
