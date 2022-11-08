type filterMapCallback<T, U> = (
  elem: T,
  idx?: number,
  arr?: Array<T>,
) => {
  include: boolean;
  return: U;
};

interface Array<T> {
  filterNulls(): NonNullable<Array<T>>;
  filterMap<U extends any>(fn: filterMapCallback<T, U>): Array<U>;
}

Array.prototype.filterNulls = function filterNulls() {
  return this.filter((v) => v !== null);
};

Array.prototype.filterMap = function filterMap<T, U extends any>(
  fn: filterMapCallback<T, U>,
) {
  let result: U[] = [];
  for (let i = 0; i < this.length; i++) {
    const ret = fn(this[i], i, this);
    if (ret.include) {
      result.push(ret.return);
    }
  }
  return result;
};
