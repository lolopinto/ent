module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testRegex: "(/tests/.*|(\\.|/)(test|spec))\\.(tsx?)$",
  rootDir: ".",
  moduleNameMapper: {
    // corresponding change from paths in tsconfig.json
    // only map ent/ at beginning instead of relative ents which are the generated ents
    "^ent/(.*)": "<rootDir>/../../src/$1",
    // map to src/ so that we don't have relative paths like "./../"
    "^src/(.*)": "<rootDir>/src/$1",
  },
  setupFilesAfterEnv: ["jest-expect-message", "jest-date-mock"],
};
