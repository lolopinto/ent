const path = require("path");
const entSource = process.env.ENT_CODEGEN_MATRIX_ENT_SRC;

module.exports = {
  preset: "ts-jest",
  // The matrix typechecks the generated app separately against dist declarations.
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: { isolatedModules: true } }],
  },
  testEnvironment: "node",
  testMatch: ["<rootDir>/src/**/*.test.ts"],
  moduleNameMapper: {
    "^@snowtop/ent$": path.join(entSource, "index.ts"),
    "^@snowtop/ent/(.*)$": path.join(entSource, "$1"),
    "^src/(.*)$": "<rootDir>/src/$1",
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
};
