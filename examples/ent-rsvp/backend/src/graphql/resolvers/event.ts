import { RequestContext } from "@snowtop/ent";
import { gqlContextType, gqlQuery } from "@snowtop/ent/graphql";
import { GraphQLString } from "graphql";
import { Event } from "src/ent";

export class EventResolver {
  @gqlQuery({
    class: "EventResolver",
    name: "eventSlugAvailable",
    type: Boolean,
    args: [
      {
        name: "slug",
        type: GraphQLString,
      },
    ],
    async: true,
  })
  async emailAvailable(slug: string) {
    // TODO add context here...
    const id = await Event.loadIdfromSlug(slug);
    return id === undefined;
  }

  @gqlQuery({
    class: "EventResolver",
    name: "event",
    type: "Event",
    nullable: true,
    async: true,
    args: [
      gqlContextType(),
      {
        name: "slug",
        type: GraphQLString,
      },
    ],
  })
  async event(context: RequestContext, slug: string) {
    return Event.loadFromSlug(context.getViewer(), slug);
  }
}
