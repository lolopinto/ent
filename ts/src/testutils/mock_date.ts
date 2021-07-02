export class MockDate {
  private static date: Date | undefined;
  // this exists so that we can reuse the same date across different places in tests
  static getDate(): Date {
    if (this.date === undefined) {
      this.date = new Date();
    }
    return this.date;
  }
}
