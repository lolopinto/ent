import { GraphQLServer } from "graphql-yoga";
import "reflect-metadata";
import { buildSchema } from "type-graphql";
import { UserResolver } from "./resolver";
//import { Context } from "./context";
import { IDViewer } from "src/util/id_viewer";

// bootstrap
async function bootstrap() {
  try {
    const schema = await buildSchema({
      resolvers: [UserResolver],
      emitSchemaFile: true,
    });
    // TODO we can change this as needed if we choose to use type-graphql
    // that can be cool. make this plug and play as needed
    const server = new GraphQLServer({
      schema,
      context: {
        viewer: new IDViewer("09ab1a18-303f-4821-980f-bdbb6fb60210"),
      },
    });

    server.start(() =>
      console.log("Server is running on http://localhost:4000"),
    );
  } catch (error) {
    console.error(error);
    console.error(error.message);
  }
}

bootstrap();
