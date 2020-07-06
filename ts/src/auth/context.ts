import { Auth, AuthViewer, getLoggedInViewer } from "./index";
import { Viewer } from "./../ent";
import { IncomingMessage, ServerResponse } from "http";
import { LoggedOutViewer } from "../viewer";

export interface Context {
  getViewer(): Viewer;
  authViewer(viewer: Viewer): Promise<void>; //logs user in and changes viewer to this
  logout(): Promise<void>;
  request: IncomingMessage;
  response: ServerResponse;
}

class contextImpl implements Context {
  constructor(
    private viewer: Viewer,
    public request: IncomingMessage,
    public response: ServerResponse,
  ) {}

  getViewer(): Viewer {
    return this.viewer;
  }

  async authViewer(viewer: Viewer): Promise<void> {
    this.viewer = viewer;
  }

  async logout(): Promise<void> {
    this.viewer = new LoggedOutViewer();
  }
}

export async function buildContext(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<Context> {
  let viewer = await getLoggedInViewer(request, response);
  return new contextImpl(viewer, request, response);
}
