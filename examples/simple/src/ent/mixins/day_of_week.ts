/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

import {
  DayOfWeekBaseMixin,
  IDayOfWeekBase,
  isDayOfWeek,
} from "../generated/mixins/day_of_week_base";

export { isDayOfWeek };

type Constructor<T = {}> = new (...args: any[]) => T;

export interface IDayOfWeek extends IDayOfWeekBase {
  // add custom fields
}

export function DayOfWeekMixin<T extends Constructor>(BaseClass: T) {
  return class DayOfWeekMixin
    extends DayOfWeekBaseMixin(BaseClass)
    implements IDayOfWeek {
    // add custom fields implementation
  };
}
