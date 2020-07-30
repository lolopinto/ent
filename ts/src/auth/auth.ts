import { Viewer } from "../core/ent";
import { LoggedOutViewer } from "../core/viewer";
import { RequestContext, ContextCache } from "../core/context";
import { IncomingMessage, ServerResponse } from "http";

export type AuthViewer = Viewer | null;
export interface Auth {
  authViewer(ctx: RequestContext): AuthViewer | Promise<AuthViewer>;
}

let handlers: Map<string, Auth> = new Map();
export async function registerAuthHandler(name: string, auth: Auth) {
  handlers.set(name, auth);
}

export async function clearAuthHandlers() {
  handlers.clear();
}

export async function getLoggedInViewer(
  context: RequestContext,
): Promise<Viewer> {
  for (const [name, authHandler] of handlers) {
    let v = await authHandler.authViewer(context);
    if (v !== null) {
      //      console.log(`auth handler ${name} authenticated user ${v.viewerID}`);
      return v;
    }
  }
  //  console.log("no auth handler returned viewer. default to logged out viewer");
  return new LoggedOutViewer();
}

export async function buildContext(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<RequestContext> {
  const ctx = new contextImpl(request, response);

  let viewer = await getLoggedInViewer(ctx);
  ctx.cache = new ContextCache();
  // TODO since this is done, whatever other call to authViewer that was needed no longer needed
  ctx.authViewer(viewer);
  return ctx;
}

class contextImpl implements RequestContext {
  cache?: ContextCache;
  private loggedOutViewer: LoggedOutViewer = new LoggedOutViewer();
  private viewer: Viewer;

  constructor(
    public request: IncomingMessage,
    public response: ServerResponse,
  ) {
    this.viewer = this.loggedOutViewer;
  }

  getViewer(): Viewer {
    return this.viewer;
  }

  async authViewer(viewer: Viewer): Promise<void> {
    this.viewer = viewer;
  }

  async logout(): Promise<void> {
    this.viewer = this.loggedOutViewer;
  }
}
