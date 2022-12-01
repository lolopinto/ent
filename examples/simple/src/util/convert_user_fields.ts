export function userConvertAccountStatus(status: any) {
  if (status === null) {
    return "UNVERIFIED";
  }
  return status;
}

export function convertSuperNestedObject(val: any) {
  // doesn't actually do anything, just there to test the double convert logic
  return val;
}
