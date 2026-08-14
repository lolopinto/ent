export default {
  testEnvironment: "node",
  testTimeout: 20000,
  extensionsToTreatAsEsm: [".ts"],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: "<rootDir>/tsconfig.json",
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
  setupFilesAfterEnv: ["jest-expect-message", "./src/testsetup/setup.ts"],
  testPathIgnorePatterns: ["dist"],
  transformIgnorePatterns: ["<rootDir>/node_modules/"],
};
