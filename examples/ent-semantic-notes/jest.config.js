export default {
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: "<rootDir>/tsconfig.json",
        diagnostics: false,
        useESM: true,
      },
    ],
  },
  testRegex: "(/tests/.*|(\\.|/)(test|spec))\\.(tsx?)$",
  rootDir: ".",
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^graphql$": "<rootDir>/node_modules/graphql/index.js",
    "^graphql/(?!.*\\.js$)(.*)$":
      "<rootDir>/node_modules/graphql/$1/index.js",
    "^src/(.*)": "<rootDir>/src/$1",
    "^@snowtop/ent$": "<rootDir>/../../ts/src/index.ts",
    "^@snowtop/ent/(.*)$": "<rootDir>/../../ts/src/$1",
    "^@snowtop/ent-pgvector$":
      "<rootDir>/../../ts/packages/ent-pgvector/src/pgvector.ts",
  },
  setupFilesAfterEnv: ["./src/testsetup/setup.ts"],
  testPathIgnorePatterns: ["dist"],
  transformIgnorePatterns: ["<rootDir>/node_modules/"],
};
