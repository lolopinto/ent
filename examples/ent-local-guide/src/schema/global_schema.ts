import { GlobalSchema } from "@snowtop/ent";
import { PostGISExtension } from "@snowtop/ent-postgis";

const globalSchema: GlobalSchema = {
  dbExtensions: [PostGISExtension()],
};

export default globalSchema;
