import { getLoggedInViewer } from "./index";
import { Viewer, ID, Ent, SelectDataOptions, createDataLoader } from "./../ent";
import { IncomingMessage, ServerResponse } from "http";
import { LoggedOutViewer } from "../viewer";

import DataLoader from "dataloader";

export interface Context {
  getViewer(): Viewer;
  authViewer(viewer: Viewer): Promise<void>; //logs user in and changes viewer to this
  logout(): Promise<void>;
  request: IncomingMessage;
  response: ServerResponse;

  // optional per request
  // absence means we are not doing any caching
  // presence means we have loader, ent cache etc
  cache?: ContextCache;
}

class contextImpl implements Context {
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

export async function buildContext(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<Context> {
  const ctx = new contextImpl(request, response);

  let viewer = await getLoggedInViewer(ctx);
  //  const ctx = new contextImpl(request, response);
  console.log("build context called");
  ctx.cache = new ContextCache();
  return ctx;
}

// or call it ViewerCache?
// or ContextCache?
// since we truly don't care about Request bounds...
// used to be RequestCachee
export class ContextCache {
  loaders: Map<string, DataLoader<ID, {}>> = new Map();

  // only create as needed for the "requests" which need it
  getEntLoader(loaderOptions: SelectDataOptions) {
    console.log(loaderOptions);
    let l = this.loaders.get(loaderOptions.tableName);

    if (l) {
      console.log("existing loader");
      return l;
    }
    l = createDataLoader(loaderOptions);
    this.loaders.set(loaderOptions.tableName, l);
    console.log("new loader");
    return l;
  }
}
