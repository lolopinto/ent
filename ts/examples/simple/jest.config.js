let moduleMapper = require("./start").getJestModuleMapper();

module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testRegex: "(/tests/.*|(\\.|/)(test|spec))\\.(tsx?)$",
  rootDir: ".",
  moduleNameMapper: moduleMapper,
  setupFilesAfterEnv: ["jest-expect-message"],
};
