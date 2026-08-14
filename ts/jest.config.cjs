module.exports = {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts", ".tsx"],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: "<rootDir>/tsconfig.jest.json",
      },
    ],
  },
  testRegex: "(/tests/.*|(\\.|/)(test|spec))\\.(tsx?)$",
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  testPathIgnorePatterns: [
    "<rootDir>/examples",
    "<rootDir>/packages",
    "<rootDir>/dist",
  ],
  modulePathIgnorePatterns: ["<rootDir>/dist/"],
  setupFilesAfterEnv: [
    "<rootDir>/jest.setup.ts",
    "jest-expect-message",
    "jest-date-mock",
  ],
};
