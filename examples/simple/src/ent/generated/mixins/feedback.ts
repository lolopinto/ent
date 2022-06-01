/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

import { ObjectToCommentsQuery, ObjectToLikersQuery } from "../../internal";

type Constructor<T = {}> = new (...args: any[]) => T;

export interface IFeedback {
  isFeedback(): boolean;
  queryComments(): ObjectToCommentsQuery;
  queryLikers(): ObjectToLikersQuery;
}

export function FeedbackMixin<T extends Constructor>(BaseClass: T) {
  return class FeedbackMixin extends BaseClass implements IFeedback {
    constructor(...args: any[]) {
      super(...args);
    }

    isFeedback() {
      return true;
    }

    queryComments(): ObjectToCommentsQuery {
      throw new Error(`Comments not implemented`);
    }

    queryLikers(): ObjectToLikersQuery {
      throw new Error(`Likers not implemented`);
    }
  };
}
