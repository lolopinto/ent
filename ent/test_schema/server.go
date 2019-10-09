package main

import (
	"log"
	"net/http"
	"os"

	"github.com/99designs/gqlgen/handler"
	"github.com/gorilla/mux"
	"github.com/lolopinto/ent/ent/test_schema/graphql"
	"github.com/lolopinto/ent/ent/viewer"
)

const defaultPort = "8080"

func authMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// by default this works with a logged out viewer.
		// TODO provide a way to inject a different viewer
		v := viewer.LoggedOutViewer()
		r = viewer.NewRequestWithContext(r, v)
		next.ServeHTTP(w, r)
	})
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = defaultPort
	}

	r := mux.NewRouter()
	r.Use(authMiddleware)

	r.Handle("/", handler.Playground("GraphQL playground", "/query"))
	r.Handle("/query", handler.GraphQL(graphql.NewExecutableSchema(graphql.Config{Resolvers: &graphql.Resolver{}})))

	log.Printf("connect to http://localhost:%s/ for GraphQL playground", port)
	log.Fatal(http.ListenAndServe(":"+port, r))
}
