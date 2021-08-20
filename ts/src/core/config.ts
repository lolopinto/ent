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

  // config for codegen
  // TODO more coming...
  // TODO come back...
  codegen?: CodegenConfig;
}

interface CodegenConfig {
  defaultEntPolicy?: PrivacyConfig;
  defaultActionPolicy?: PrivacyConfig;
}

interface PrivacyConfig {
  path: string; // e.g. "@snowtop/ent"
  policyName: string; // e.g. "AllowIfViewerHasIdentityPrivacyPolicy";
  class?: boolean;
}

function setConfig(cfg: Config) {
  if (cfg.log) {
    setLogLevels(cfg.log);
  }

  if (cfg.dbConnectionString || cfg.dbFile || cfg.db) {
    DB.initDB({
      connectionString: cfg.dbConnectionString,
      dbFile: cfg.dbFile,
      db: cfg.db,
    });
  }
}

function isBuffer(b: Buffer | Config): b is Buffer {
  return (b as Buffer).write !== undefined;
}

export function loadConfig(file?: string | Buffer | Config) {
  let data: string;
  if (typeof file === "object") {
    if (!isBuffer(file)) {
      return setConfig(file);
    }
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
    let yaml = load(data);
    if (typeof yaml !== "object") {
      throw new Error(`invalid yaml passed`);
    }
    setConfig(yaml as Config);
  } catch (e) {
    console.error(`error parsing yaml file`, e);
    throw e;
  }
}
