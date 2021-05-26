import { Viewer } from "../core/base";
import { LoggedOutViewer } from "../core/viewer";
import { RequestContext, ContextCache } from "../core/context";
import { IncomingMessage, ServerResponse } from "http";
import { log } from "../core/logger";

export type AuthViewer = Viewer | null;
export interface AuthHandler {
  authViewer(ctx: RequestContext): AuthViewer | Promise<AuthViewer>;
}

let handlers: Map<string, AuthHandler> = new Map();
export async function registerAuthHandler(name: string, auth: AuthHandler) {
  handlers.set(name, auth);
}

export async function clearAuthHandlers() {
  handlers.clear();
}

export async function getLoggedInViewer(
  context: RequestContext,
): Promise<Viewer | null> {
  for (const [name, authHandler] of handlers) {
    let v = await authHandler.authViewer(context);
    if (v !== null) {
      log(
        "info",
        `auth handler \`${name}\` authenticated user \`${v.viewerID}\``,
      );
      return v;
    }
  }
  log("info", "no auth handler returned viewer. default to logged out viewer");
  return null;
}

export async function buildContext(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<RequestContext> {
  const ctx = new contextImpl(request, response);
  let viewer = await getLoggedInViewer(ctx);
  if (viewer) {
    // TODO since this is done, whatever other call to authViewer that was needed no longer needed
    ctx.authViewer(viewer);
  }
  return ctx;
}

class contextImpl implements RequestContext {
  cache?: ContextCache;
  private loggedOutViewer: LoggedOutViewer;
  private viewer: Viewer;

  constructor(
    public request: IncomingMessage,
    public response: ServerResponse,
  ) {
    this.cache = new ContextCache();
    // needs to be after this.cache above
    this.loggedOutViewer = new LoggedOutViewer(this);
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
