import { glob } from "glob";
import * as path from "path";
import * as fs from "fs";

// src/ent/generated and src/graphql/generated

function moveFiles(files: string[]) {
  files.forEach((file) => {
    const parts = file.split(path.sep);
    if (parts.length < 3) {
      return;
    }

    const changedParts = parts
      .slice(0, 2)
      .concat("generated")
      .concat(parts.slice(2).filter((v) => v !== "generated"));

    const newFile = changedParts.join(path.sep);
    if (file === newFile) {
      return;
    }

    // check if directory exists, if not, create recursive dir
    const p = changedParts.slice(0, changedParts.length - 1).join(path.sep);
    const statInfo = fs.statSync(p, { throwIfNoEntry: false });
    if (!statInfo) {
      fs.mkdirSync(p, {
        recursive: true,
      });
    }

    // move file to new location
    fs.renameSync(file, newFile);
  });
}
function main() {
  const entFiles = glob.sync("src/ent/**/generated/**/**.ts");
  const graphqlFiles = glob.sync("src/graphql/**/generated/**/**.ts");

  moveFiles(entFiles);
  moveFiles(graphqlFiles);
}

main();
