module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testRegex: "(/tests/.*|(\\.|/)(test|spec))\\.(tsx?)$",
  rootDir: ".",
  globals: {
    "ts-jest": {
      diagnostics: false,
      isolatedModules: true,
    },
  },
  moduleNameMapper: {
    // corresponding change from paths in tsconfig.json
    // map to src/ so that we don't have relative paths like "./../"
    "^src/(.*)": "<rootDir>/src/$1",
    "^@snowtop/ent$": "<rootDir>/../../ts/src/index.ts",
    "^@snowtop/ent/(.*)$": "<rootDir>/../../ts/src/$1",
    "^graphql$": "<rootDir>/node_modules/graphql/index.js",
    "^graphql/(.*)$": "<rootDir>/node_modules/graphql/$1",
  },
  setupFilesAfterEnv: [
    "jest-expect-message",
    "jest-date-mock",
    "./src/testsetup/setup.ts",
  ],
  globalSetup: "./src/testsetup/globalSetup.ts",
  globalTeardown: "./src/testsetup/globalTeardown.ts",
  testPathIgnorePatterns: ["dist"],
  transformIgnorePatterns: ["<rootDir>/node_modules/"],
};
