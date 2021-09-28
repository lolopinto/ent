export enum Mode {
  SMS = 1,
  EMAIL = 2,
}

export interface commsInput {
  subject?: string;
  body: string;
  from: string;
  to: string;
  mode: Mode;
}

export class FakeComms {
  private static sent: commsInput[] = [];

  static send(option: commsInput) {
    this.sent.push(option);
  }

  static async sendAsync(option: commsInput) {
    await new Promise((resolve) => setTimeout(resolve, 10));
    this.sent.push(option);
  }

  static verifySent(to: string, mode: Mode, opts?: { subject; body }) {
    let sent = this.sent.filter(
      (option) => option.to === to && option.mode === mode,
    );
    expect(sent.length).toBeGreaterThan(0);
    if (opts) {
      expect(sent[0].body).toBe(opts.body);
      expect(sent[0].subject).toBe(opts.subject);
    }
  }

  static getSent(to: string, mode: Mode) {
    return this.sent.filter(
      (option) => option.to === to && option.mode === mode,
    );
  }

  static verifyNoEmailSent() {
    expect(this.sent.length).toBe(0);
  }

  static clear() {
    this.sent = [];
  }
}
