import { IncomingMessage, ServerResponse } from "http";
import { Ent, ID, RequestContext, Viewer, LoggedOutViewer } from "@snowtop/ent";
import { PassportStrategyHandler } from "@snowtop/ent-passport";
import { User } from "src/ent";

export class OurContext
  implements RequestContext<Viewer<Ent<any> | null, ID | null>>
{
  private viewer: Viewer<Ent<any> | null, ID | null>;

  constructor(
    public request: IncomingMessage,
    public response: ServerResponse,
  ) {
    this.viewer = new LoggedOutViewer();
    this.viewer.context = this;
  }

  async authViewer(viewer: Viewer<Ent<any> | null, ID | null>): Promise<void> {
    this.viewer = viewer;
  }

  async logout(): Promise<void> {
    this.viewer = new LoggedOutViewer();
  }

  getViewer(): Viewer<Ent<any> | null, ID | null> {
    return this.viewer;
  }

  static async createFromRequest(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<OurContext> {
    const handler = PassportStrategyHandler.jwtHandler({
      secretOrKey: "secret",
      loaderOptions: User.loaderOptions(),
    });
    const ctx = new OurContext(request, response);
    const viewer = await handler.authViewer(ctx);
    if (viewer) {
      ctx.authViewer(viewer);
    }
    return ctx;
  }
}
