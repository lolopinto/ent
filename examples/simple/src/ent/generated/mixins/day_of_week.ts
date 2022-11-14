/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

import { Data, Viewer } from "@snowtop/ent";
import { DayOfWeek, DayOfWeekAlt } from "../types";

type Constructor<T = {}> = new (...args: any[]) => T;

export interface IDayOfWeek {
  isDayOfWeek(): boolean;
  dayOfWeek: DayOfWeek;
  dayOfWeekAlt: DayOfWeekAlt | null;
}

function extractFromArgs<TViewer extends Viewer, TData extends Data>(
  args: any[],
): { viewer: TViewer; data: TData } {
  if (args.length !== 2) {
    throw new Error("args should be length 2");
  }
  return {
    viewer: args[0],
    data: args[1],
  };
}

export function DayOfWeekMixin<T extends Constructor>(BaseClass: T) {
  return class DayOfWeekMixin extends BaseClass {
    readonly dayOfWeek: DayOfWeek;
    readonly dayOfWeekAlt: DayOfWeekAlt | null;
    constructor(...args: any[]) {
      super(...args);
      const { data } = extractFromArgs(args);
      this.dayOfWeek = data.day_of_week;
      this.dayOfWeekAlt = data.day_of_week_alt;
    }

    isDayOfWeek() {
      return true;
    }
  };
}
