/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

import { Ent } from "@snowtop/ent";
import {
  FeedbackBaseMixin,
  IFeedbackBase,
} from "../generated/mixins/feedback_base";

type Constructor<T extends Ent = Ent> = new (...args: any[]) => T;

export interface IFeedback extends IFeedbackBase {
  // add custom fields
  isFeedback(): boolean;
}

export function isFeedback(ent: unknown): ent is IFeedback {
  const o = ent as IFeedback;
  return (o.isFeedback && o.isFeedback()) ?? false;
}

export function FeedbackMixin<T extends Constructor>(BaseClass: T) {
  // THIS DOESN'T WORK BECAUSE DOESN'T HAVE IFeedbackBase methods
  return class FeedbackMixin
    extends FeedbackBaseMixin(BaseClass)
    implements IFeedback
  {
    // add custom fields implementation

    isFeedback() {
      return true;
    }
  };
}
