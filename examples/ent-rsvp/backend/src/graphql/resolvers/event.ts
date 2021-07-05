import { RequestContext } from "@snowtop/ent";
import { gqlArg, gqlContextType, gqlQuery } from "@snowtop/ent/graphql";
import { Event } from "src/ent";

export class EventResolver {
  @gqlQuery({ name: "eventSlugAvailable", type: Boolean })
  async emailAvailable(@gqlArg("slug") slug: string) {
    // TODO add context here...
    const id = await Event.loadIDFromSlug(slug);
    return id === undefined;
  }

  @gqlQuery({ name: "event", type: "Event", nullable: true })
  async event(
    @gqlContextType() context: RequestContext,
    @gqlArg("slug") slug: string,
  ) {
    return await Event.loadFromSlug(context.getViewer(), slug);
  }
}
