const fs = require("fs");
const JSON5 = require("json5");
const path = require("path");

let json = null;
let paths = undefined;
function readJSONFile() {
  if (json !== null) {
    return json;
  }

  try {
    json = JSON5.parse(
      fs.readFileSync("./tsconfig.json", {
        encoding: "utf8",
      }),
    );
  } catch (e) {
    console.error("couldn't read tsconfig.json file");
    json = {};
  }
  return json;
}

function getPaths() {
  if (paths !== undefined) {
    return paths;
  }
  let options = readJSONFile();
  if (options.compilerOptions && options.compilerOptions.paths) {
    paths = options.compilerOptions.paths;
  } else {
    paths = null;
  }
  return paths;
}

function convertStarValue(starValue) {
  let aliasKey = starValue;
  let idx = starValue.indexOf("/");
  if (idx !== -1) {
    aliasKey = starValue.substr(0, idx);
  }
  return aliasKey;
}

function getWebpackAlias() {
  function convertPath(path) {
    let idx = path.lastIndexOf("/");
    if (idx !== -1) {
      path = path.substr(0, idx);
    }
    return path;
  }

  return processPaths(
    convertPath,
    (value) => {
      value = convertPath(value);
      return path.resolve(__dirname, value);
    },
    convertStarValue,
  );
}

function getJestModuleMapper() {
  return processPaths(
    (key) => {
      return `^${key.replace("*", "(.*)")}`;
    },
    (value) => {
      // remove leading paths: ./
      if (value.startsWith("./")) {
        value = value.substr(2);
      }
      value = "<rootDir>/" + value;
      return value.replace("*", "$1");
    },
    convertStarValue,
  );
}

function processPaths(transformKey, transformValue, transformStarValue) {
  let result = {};
  let paths = getPaths();
  if (!paths) {
    return result;
  }

  for (let key in paths) {
    let values = paths[key];
    if (!Array.isArray(values)) {
      console.error("format of value is not as expected");
      break;
    }

    // special case. come back
    if (key === "*") {
      values.forEach((value) => {
        if (value === "*") {
          return;
        }
        let aliasKey = transformStarValue(value);
        value = transformValue(value);
        result[aliasKey] = value;
      });
    } else {
      key = transformKey(key);

      values.forEach((value) => {
        result[key] = transformValue(value);
      });
    }
  }
  return result;
}

module.exports = {
  getWebpackAlias,
  getJestModuleMapper,
};
