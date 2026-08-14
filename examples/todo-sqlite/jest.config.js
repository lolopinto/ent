module.exports = {
  extensionsToTreatAsEsm: [".ts"],
  testEnvironment: "node",
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: {
          target: "ES2022",
          module: "ESNext",
          moduleResolution: "Bundler",
          isolatedModules: true,
        },
      },
    ],
  },
  testRegex: "(/tests/.*|(\\.|/)(test|spec))\\.(tsx?)$",
  rootDir: ".",
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    // corresponding change from paths in tsconfig.json
    // map to src/ so that we don't have relative paths like "./../"
    "^src/(.*)": "<rootDir>/src/$1",
  },
  setupFilesAfterEnv: [
    "jest-expect-message",
    "jest-date-mock",
    "./src/testsetup/setup.ts",
  ],
  testPathIgnorePatterns: ["dist"],
  transformIgnorePatterns: ["<rootDir>/node_modules/"],
};
