import { gqlField, gqlObjectType } from "@snowtop/ent/graphql";
import { GraphQLInt, GraphQLString } from "graphql";

@gqlObjectType({ name: "City" })
export class City {
  constructor(population: number, name: string) {
    this.name = name;
    this.population = population;
  }

  @gqlField({
    name: "name",
    type: GraphQLString,
    class: "City",
  })
  name: string;

  @gqlField({
    name: "population",
    type: GraphQLInt,
    class: "City",
  })
  population: number;
}
