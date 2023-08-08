import { GraphQLEnumType } from "graphql";

export enum ContactLabel2 {
  Work = "work",
  Home = "home",
  Default = "default",
  Unknown = "unknown",
  Self = "self",
}

export const GraphQLContactLabel2 = new GraphQLEnumType({
  name: "ContactLabel2",
  values: {
    WORK: {
      value: "work",
    },
    HOME: {
      value: "home",
    },
    DEFAULT: {
      value: "default",
    },
    UNKNOWN: {
      value: "unknown",
    },
    SELF: {
      value: "self",
    },
  },
});
