package main

import (
	"log"
	"os"

	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/db"
)

// run locally to fix db
// in test_setup folder
// `DB_CONNECTION_STRING=postgres://ola@localhost/ent_test go run .`
func main() {
	env := os.Getenv("DB_CONNECTION_STRING")
	if env == "" {
		log.Fatal("DB_CONNECTION_STRING env variable is required")
	}

	codepath := codegen.NewCodePath("../internal/test_schema/models/configs", "")
	db.UpgradeDB(codepath, "head")

	// fix edges if broken
	db.FixEdges(codepath)
}
