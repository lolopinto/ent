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

	cfg, err := codegen.NewConfig("../internal/test_schema/models/configs", "")
	if err != nil {
		log.Fatal(err)
	}
	if err := db.UpgradeDB(cfg, "head", true); err != nil {
		log.Fatal(err)
	}

	// fix edges if broken
	if err := db.FixEdges(cfg); err != nil {
		log.Fatal(err)
	}
}
