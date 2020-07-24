//import graphqlHTTP from "express-graphql";
//
import { IncomingMessage, ServerResponse } from "http";
import { Viewer } from "../ent";
import { LoggedOutViewer } from "../viewer";
import { RequestContext } from "./context";

type Request = IncomingMessage;
type Response = ServerResponse;

export type AuthViewer = Viewer | null;
export interface Auth {
  authViewer(
    ctx: RequestContext,
  ): // TODO
  //    request: Request,
  //    response: Response,
  //    params?: graphqlHTTP.OptionsData.GraphQLParams,
  AuthViewer | Promise<AuthViewer>;
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

//
