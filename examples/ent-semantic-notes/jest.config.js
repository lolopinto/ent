const path = require("path");

const tsJest = require.resolve("ts-jest", {
  paths: [path.resolve(__dirname, "../../ts/node_modules")],
});

module.exports = {
  testEnvironment: "node",
  transform: {
    "^.+\\.tsx?$": [
      tsJest,
      {
        tsconfig: "<rootDir>/tsconfig.json",
        diagnostics: false,
      },
    ],
  },
  testRegex: "(/tests/.*|(\\.|/)(test|spec))\\.(tsx?)$",
  rootDir: ".",
  moduleNameMapper: {
    "^src/(.*)": "<rootDir>/src/$1",
    "^@snowtop/ent$": "<rootDir>/../../ts/src/index.ts",
    "^@snowtop/ent/(.*)$": "<rootDir>/../../ts/src/$1",
    "^@snowtop/ent-pgvector$":
      "<rootDir>/../../ts/packages/ent-pgvector/src/pgvector.ts"
  },
  setupFilesAfterEnv: ["./src/testsetup/setup.ts"],
  testPathIgnorePatterns: ["dist"],
  transformIgnorePatterns: ["<rootDir>/node_modules/"]
};
