import { Viewer } from "ent/ent";
import { IncomingMessage, ServerResponse } from "http";

// TODO need to autogenerate this file once
export interface Context {
  // should be getViewer because it's changeable...
  viewer: Viewer;
  request: IncomingMessage;
  response: ServerResponse;
}
