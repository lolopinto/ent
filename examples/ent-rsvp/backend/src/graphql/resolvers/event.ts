import { RequestContext } from "@lolopinto/ent";
import { gqlArg, gqlContextType, gqlQuery } from "@lolopinto/ent/graphql";
import { Event } from "src/ent";

export class EventResolver {
  @gqlQuery({ name: "eventSlugAvailable", type: Boolean })
  async emailAvailable(@gqlArg("slug") slug: string) {
    const id = await Event.loadIDFromSlug(slug);
    return id === null;
  }

  // TODO can't call this event because it clashes with built in event-type
  // TODO this doesn't generate EventType so need to fix that...
  // so need to come up with new name and new path
  @gqlQuery({ name: "eventt", type: "Event", nullable: true })
  async event(
    @gqlContextType() context: RequestContext,
    @gqlArg("slug") slug: string,
  ) {
    return await Event.loadFromSlug(context.getViewer(), slug);
  }
}
