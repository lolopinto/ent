export class MockLogs {
  oldConsoleError;
  oldConsoleLog;
  logs: any[] = [];
  errors: any[] = [];

  mock() {
    this.oldConsoleLog = console.log;
    this.oldConsoleError = console.error;

    console.log = (...any) => {
      this.logs.push(...any);
    };
    console.error = (...any) => {
      this.errors.push(...any);
    };
  }

  restore() {
    console.log = this.oldConsoleLog;
    console.error = this.oldConsoleError;
  }

  clear() {
    this.logs = [];
    this.errors = [];
  }

  logAt(idx: number) {
    return this.logs[idx];
  }

  verifyNoErrors() {
    if (this.errors.length !== 0) {
      console.debug(this.errors);
    }
    expect(this.errors.length).toBe(0);
  }
}
