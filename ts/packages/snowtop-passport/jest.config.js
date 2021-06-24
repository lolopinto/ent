module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  transform: {
    "^.+\\.tsx?$": "ts-jest",
  },
  testRegex: "(/tests/.*|(\\.|/)(test|spec))\\.(tsx?)$",
  setupFilesAfterEnv: ["jest-expect-message"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
};
