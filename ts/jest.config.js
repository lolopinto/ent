module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  transform: {
    "^.+\\.tsx?$": "ts-jest",
  },
  testRegex: "(/tests/.*|(\\.|/)(test|spec))\\.(tsx?)$",
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  //  projects: ["<rootDir>", "<rootDir>/examples/simple/"],
  // ignore subdirectories until I figure out how to get projects and root files/module name mapper working correctly
  testPathIgnorePatterns: [
    "<rootDir>/examples",
    "<rootDir>/packages",
    "<rootDir>/dist",
  ],
  //  collectCoverage: true,
  setupFilesAfterEnv: ["@alex_neo/jest-expect-message", "jest-date-mock"],
  // doesn't work because db.ts depends on "config/database.yml" being called from root of each project
  //  projects: ["<rootDir>", "<rootDir>/examples/*"],
};
