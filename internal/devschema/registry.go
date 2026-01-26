package devschema

import (
	"fmt"
	"strings"

	"github.com/jmoiron/sqlx"
)

const (
	registryTable = "public.ent_dev_schema_registry"
	registryDDL   = `
CREATE TABLE IF NOT EXISTS public.ent_dev_schema_registry (
  schema_name TEXT PRIMARY KEY,
  branch_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now()
)`
	registryUpsert = `
INSERT INTO public.ent_dev_schema_registry (schema_name, branch_name, created_at, last_used_at)
VALUES ($1, $2, now(), now())
ON CONFLICT (schema_name)
DO UPDATE SET last_used_at = now(), branch_name = EXCLUDED.branch_name
`
	registrySelectPrune = `
SELECT schema_name
FROM public.ent_dev_schema_registry
WHERE schema_name LIKE $1
  AND last_used_at < (now() - $2::interval)
`
	registryDelete = "DELETE FROM public.ent_dev_schema_registry WHERE schema_name = $1"
)

type PruneOptions struct {
	Prefix string
	Days   int
	DryRun bool
}

func EnsureRegistry(db *sqlx.DB) error {
	_, err := db.Exec(registryDDL)
	return err
}

func EnsureSchema(db *sqlx.DB, schemaName string) error {
	if schemaName == "" {
		return nil
	}
	ident := quoteIdent(schemaName)
	_, err := db.Exec(fmt.Sprintf("CREATE SCHEMA IF NOT EXISTS %s", ident))
	return err
}

func TouchSchema(db *sqlx.DB, schemaName, branchName string) error {
	if schemaName == "" {
		return nil
	}
	if err := EnsureRegistry(db); err != nil {
		return err
	}
	_, err := db.Exec(registryUpsert, schemaName, branchName)
	return err
}

func PruneSchemas(db *sqlx.DB, opts PruneOptions) ([]string, error) {
	if err := EnsureRegistry(db); err != nil {
		return nil, err
	}
	prefix := opts.Prefix
	if prefix == "" {
		prefix = DefaultPrefix
	}
	days := opts.Days
	if days <= 0 {
		days = DefaultPruneDays
	}

	rows, err := db.Queryx(registrySelectPrune, prefix+"%", fmt.Sprintf("%d days", days))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var toDrop []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		toDrop = append(toDrop, name)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	var dropped []string
	for _, name := range toDrop {
		if !strings.HasPrefix(name, prefix) {
			continue
		}
		exists, err := schemaExists(db, name)
		if err != nil {
			return dropped, err
		}
		if !exists {
			if _, err := db.Exec(registryDelete, name); err != nil {
				return dropped, err
			}
			continue
		}
		if opts.DryRun {
			dropped = append(dropped, name)
			continue
		}
		if err := dropSchema(db, name); err != nil {
			return dropped, err
		}
		if _, err := db.Exec(registryDelete, name); err != nil {
			return dropped, err
		}
		dropped = append(dropped, name)
	}

	return dropped, nil
}

func dropSchema(db *sqlx.DB, schemaName string) error {
	ident := quoteIdent(schemaName)
	_, err := db.Exec(fmt.Sprintf("DROP SCHEMA %s CASCADE", ident))
	return err
}

func schemaExists(db *sqlx.DB, schemaName string) (bool, error) {
	var exists bool
	err := db.Get(&exists, "SELECT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = $1)", schemaName)
	if err != nil {
		return false, err
	}
	return exists, nil
}

func quoteIdent(name string) string {
	return `"` + strings.ReplaceAll(name, `"`, `""`) + `"`
}
