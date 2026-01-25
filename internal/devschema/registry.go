package devschema

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/jmoiron/sqlx"
)

const registryTable = "public.ent_dev_schema_registry"

type PruneOptions struct {
	Prefix string
	Days   int
	DryRun bool
}

func EnsureRegistry(db *sqlx.DB) error {
	_, err := db.Exec(fmt.Sprintf(`
CREATE TABLE IF NOT EXISTS %s (
  schema_name TEXT PRIMARY KEY,
  branch_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now()
)`, registryTable))
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
	_, err := db.Exec(fmt.Sprintf(`
INSERT INTO %s (schema_name, branch_name, created_at, last_used_at)
VALUES ($1, $2, now(), now())
ON CONFLICT (schema_name)
DO UPDATE SET last_used_at = now(), branch_name = EXCLUDED.branch_name
`, registryTable), schemaName, branchName)
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
		days = 30
	}

	query := fmt.Sprintf(`
SELECT schema_name
FROM %s
WHERE schema_name LIKE $1
  AND last_used_at < (now() - $2::interval)
`, registryTable)

	rows, err := db.Queryx(query, prefix+"%", fmt.Sprintf("%d days", days))
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
		if !schemaExists(db, name) {
			_, _ = db.Exec(fmt.Sprintf("DELETE FROM %s WHERE schema_name = $1", registryTable), name)
			continue
		}
		if opts.DryRun {
			dropped = append(dropped, name)
			continue
		}
		if err := dropSchema(db, name); err != nil {
			return dropped, err
		}
		_, _ = db.Exec(fmt.Sprintf("DELETE FROM %s WHERE schema_name = $1", registryTable), name)
		dropped = append(dropped, name)
	}

	return dropped, nil
}

func dropSchema(db *sqlx.DB, schemaName string) error {
	ident := quoteIdent(schemaName)
	_, err := db.Exec(fmt.Sprintf("DROP SCHEMA %s CASCADE", ident))
	return err
}

func schemaExists(db *sqlx.DB, schemaName string) bool {
	var exists bool
	err := db.Get(&exists, "SELECT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = $1)", schemaName)
	if err != nil {
		return false
	}
	return exists
}

func quoteIdent(name string) string {
	return `"` + strings.ReplaceAll(name, `"`, `""`) + `"`
}

func ParsePruneEnabled() bool {
	if v := parseEnvBool("ENT_DEV_SCHEMA_PRUNE_ENABLED"); v != nil {
		return *v
	}
	return false
}

func ParsePruneDays() int {
	val := firstEnv("ENT_DEV_SCHEMA_PRUNE_DAYS")
	if val == "" {
		return 30
	}
	if n, err := strconv.Atoi(val); err == nil {
		return n
	}
	return 30
}
