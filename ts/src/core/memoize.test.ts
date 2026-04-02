import { memoizeNoArgs } from "./memoize";

describe("memoizeNoArgs", () => {
  test("memoizes a synchronous result", () => {
    const fn = jest.fn(() => ({ value: 1 }));
    const memoized = memoizeNoArgs(fn);

    const first = memoized();
    const second = memoized();

    expect(first).toBe(second);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test("memoizes a promise result", async () => {
    const value = Promise.resolve("ok");
    const fn = jest.fn(() => value);
    const memoized = memoizeNoArgs(fn);

    const first = memoized();
    const second = memoized();

    expect(first).toBe(second);
    await expect(first).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test("does not cache a synchronous throw", () => {
    const err = new Error("boom");
    const fn = jest
      .fn()
      .mockImplementationOnce(() => {
        throw err;
      })
      .mockImplementationOnce(() => "ok");
    const memoized = memoizeNoArgs(fn);

    expect(() => memoized()).toThrow(err);
    expect(memoized()).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
