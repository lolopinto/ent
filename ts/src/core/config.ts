import * as fs from "fs";
import { load } from "js-yaml";
import DB, { Database, DBDict } from "./db";
import * as path from "path";
import { setLogLevels } from "./logger";

type logType = "query" | "warn" | "info" | "error" | "debug";

// ent.config.ts eventually. for now ent.yml
// or ent.yml?

export interface Config {
  dbConnectionString?: string;
  dbFile?: string; // config/database.yml is default
  db?: Database | DBDict;
  log?: logType | logType[]; // default is 'error'
  // warn will be deprecared or weird things
  // info is tbd. graphql/performance/timing/request stuff
  // query includes cache hit. redis|memcache etc eventually
}

export function loadConfig(file?: string | Buffer) {
  let data: string;
  if (typeof file === "object") {
    data = file.toString();
  } else {
    file = file || "ent.yml";
    if (!path.isAbsolute(file)) {
      file = path.join(process.cwd(), file);
    }
    if (!fs.existsSync(file)) {
      return DB.initDB();
    }
    try {
      data = fs.readFileSync(file, { encoding: "utf8" });
    } catch (e) {
      console.error(`error opening file: ${file}`);
      return DB.initDB();
    }
  }

  try {
    console.log("data", data);
    let yaml = load(data);
    console.log("yaml", yaml);
    if (typeof yaml !== "object") {
      throw new Error(`invalid yaml passed`);
    }
    let cfg = yaml as Config;
    if (cfg.log) {
      setLogLevels(cfg.log);
    }

    if (cfg.dbConnectionString || cfg.dbFile || cfg.db) {
      console.log("pre-init db,", cfg);
      DB.initDB({
        connectionString: cfg.dbConnectionString,
        dbFile: cfg.dbFile,
        db: cfg.db,
      });
    }
  } catch (e) {
    console.error(`error parsing yaml file`, e);
    throw e;
  }
}
