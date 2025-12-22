export default {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: {
          module: "nodenext",
          isolatedModules: true,
        },
      },
    ],
  },
  extensionsToTreatAsEsm: [".ts"],
  testRegex: "(/tests/.*|(\\.|/)(test|spec))\\.(tsx?)$",
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  //  projects: ["<rootDir>", "<rootDir>/examples/simple/"],
  // ignore subdirectories until I figure out how to get projects and root files/module name mapper working correctly
  testPathIgnorePatterns: [
    "<rootDir>/examples",
    "<rootDir>/packages",
    "<rootDir>/dist",
  ],
  //  collectCoverage: true,
  setupFilesAfterEnv: ["jest-expect-message", "jest-date-mock"],
  // doesn't work because db.ts depends on "config/database.yml" being called from root of each project
  //  projects: ["<rootDir>", "<rootDir>/examples/*"],
};
