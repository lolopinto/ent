export default {
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
        diagnostics: false,
        tsconfig: "<rootDir>/tsconfig.json",
      },
    ],
  },
  testRegex: "(/tests/.*|(\\.|/)(test|spec))\\.(tsx?)$",
  setupFilesAfterEnv: ["jest-expect-message"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^graphql$": "<rootDir>/node_modules/graphql/index.js",
    "^graphql/(?!.*\\.js$)(.*)$":
      "<rootDir>/node_modules/graphql/$1/index.js",
    "^@snowtop/ent$": "<rootDir>/../../src/index.ts",
    "^@snowtop/ent/(.*)$": "<rootDir>/../../src/$1",
    "^@snowtop/ent-graphql-tests$":
      "<rootDir>/../ent-graphql-tests/src/index.ts",
  },
};
