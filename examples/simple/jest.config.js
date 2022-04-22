module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testRegex: "(/tests/.*|(\\.|/)(test|spec))\\.(tsx?)$",
  rootDir: ".",
  moduleNameMapper: {
    // corresponding change from paths in tsconfig.json
    // map to src/ so that we don't have relative paths like "./../"
    "^src/(.*)": "<rootDir>/src/$1",
  },
  setupFilesAfterEnv: [
    "@alex_neo/jest-expect-message",
    "jest-date-mock",
    "./src/testsetup/setup.ts",
  ],
  globalSetup: "./src/testsetup/globalSetup.ts",
  globalTeardown: "./src/testsetup/globalTeardown.ts",
  testPathIgnorePatterns: ["dist"],
  transformIgnorePatterns: ["<rootDir>/node_modules/"],
};
