import { RequestContext } from "@lolopinto/ent";
import { gqlArg, gqlContextType, gqlQuery } from "@lolopinto/ent/graphql";
import { Event } from "src/ent";

export class EventResolver {
  @gqlQuery({ name: "eventSlugAvailable", type: Boolean })
  async emailAvailable(@gqlArg("slug") slug: string) {
    const id = await Event.loadIDFromSlug(slug);
    return id === null;
  }

  @gqlQuery({ name: "event", type: "Event", nullable: true })
  async event(
    @gqlContextType() context: RequestContext,
    @gqlArg("slug") slug: string,
  ) {
    return await Event.loadFromSlug(context.getViewer(), slug);
  }
}
