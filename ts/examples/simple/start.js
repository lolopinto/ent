const fs = require("fs");
const JSON5 = require("json5");
const path = require("path");

function getWebpackAlias() {
  let alias = {};
  // grab the paths from tsconfig.json instead of copying this code multiple times

  try {
    //https://www.typescriptlang.org/docs/handbook/module-resolution.html#path-mapping
    // TODO: don't really use the * case well so need to write tests for it
    function convertPath(path) {
      let idx = path.lastIndexOf("/");
      if (idx !== -1) {
        path = path.substr(0, idx);
      }
      return path;
    }

    let options = JSON5.parse(
      fs.readFileSync("./tsconfig.json", {
        encoding: "utf8",
      }),
    );
    let paths;
    if (options.compilerOptions && options.compilerOptions.paths) {
      paths = options.compilerOptions.paths;
    }
    if (paths) {
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
            let aliasKey = value;
            let idx = value.indexOf("/");
            if (idx !== -1) {
              alias = value.substr(0, idx);
            }
            alias[aliasKey] = convertPath(value);
          });
        } else {
          key = convertPath(key);

          values.forEach((value) => {
            value = convertPath(value);
            console.log(value);

            alias[key] = path.resolve(__dirname, value);
          });
        }
      }
    }
  } catch (e) {
    console.error("couldn't read tsconfig.json file");
  }
  return alias;
}

module.exports = {
  getWebpackAlias,
};
