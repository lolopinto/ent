import { Ent } from "../core/base";
import { Builder } from "./../action";

export class FakeLogger {
  // todo this is quick and ideal.
  // more ideal is capturing all console.logs
  // we do it in golang for example
  // and will need this for production launch anyways
  private static logs: string[] = [];

  static log(line: string) {
    this.logs.push(line);
  }

  static verifyNoLogs() {
    expect(this.logs.length).toBe(0);
  }

  static verifyLogs(length?: number) {
    expect(this.logs.length).toBeGreaterThan(0);
    if (length) {
      expect(this.logs.length).toBe(length);
    }
  }

  static contains(line: string): boolean {
    return this.logs.some((log) => log === line);
  }

  static clear() {
    this.logs = [];
  }
}

// TODO instead of needing to add this manually
// we need to build a way to add global observers (and maybe triggers)
// to be run on every action/mutation
// logger is an obvious one that's needed/ wanted on every action
export class EntCreationObserver<T extends Ent> {
  async observe(builder: Builder<T>) {
    if (!builder.editedEnt) {
      return;
    }
    let ent = await builder.editedEnt();
    if (ent) {
      FakeLogger.log(`ent ${builder.ent.name} created with id ${ent.id}`);
    }
  }
}
