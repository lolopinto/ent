import { writeJSONToStdout } from "./stdout";

describe("writeJSONToStdout", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("waits for stdout write callback before resolving", async () => {
    let writeCallback: ((err?: Error | null) => void) | undefined;
    const chunks: string[] = [];

    jest.spyOn(process.stdout, "write").mockImplementation(((
      chunk: unknown,
      encodingOrCallback?: unknown,
      callback?: unknown,
    ) => {
      chunks.push(String(chunk));
      writeCallback =
        typeof encodingOrCallback === "function"
          ? (encodingOrCallback as (err?: Error | null) => void)
          : (callback as (err?: Error | null) => void);

      return true;
    }) as typeof process.stdout.write);

    let resolved = false;
    const promise = writeJSONToStdout({ ok: true }).then(() => {
      resolved = true;
    });

    await Promise.resolve();

    expect(chunks).toEqual([JSON.stringify({ ok: true })]);
    expect(writeCallback).toEqual(expect.any(Function));
    expect(resolved).toBe(false);

    writeCallback?.();
    await promise;

    expect(resolved).toBe(true);
  });
});
