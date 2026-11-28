package db

import (
	"testing"

	"github.com/lolopinto/ent/internal/codegen"
	"github.com/stretchr/testify/require"
)

func TestIncrementalSnapshotFormatTransition(t *testing.T) {
	const header = "-- ent schema snapshot format: 1\n"
	const legacy = "CREATE EXTENSION IF NOT EXISTS hstore;\n"
	const current = header + "CREATE EXTENSION IF NOT EXISTS hstore VERSION '1.8';\n"
	for _, tc := range []struct {
		name          string
		before, after string
		changeSchema  bool
		wantError     string
	}{
		{name: "refresh legacy format without a migration", before: legacy, after: current},
		{name: "unchanged current format", before: current, after: current},
		{name: "current format still detects drift", before: current, after: current + "SELECT 1;\n", wantError: "schema.sql changed"},
		{name: "legacy format still detects drift", before: legacy, after: legacy + "SELECT 1;\n", wantError: "schema.sql changed"},
		{name: "format refresh cannot hide schema changes", before: legacy, after: current, changeSchema: true, wantError: "schema.py changed"},
		{name: "unknown format is not a refresh", before: legacy, after: "-- ent schema snapshot format: 2\n" + legacy, wantError: "schema.sql changed"},
		{name: "format downgrade is not a refresh", before: "-- ent schema snapshot format: 2\n" + legacy, after: current, wantError: "schema.sql changed"},
		{name: "removing the marker is not a refresh", before: current, after: legacy, wantError: "schema.sql changed"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			info := func(sql, schema string) *dbFileInfo {
				return &dbFileInfo{
					schemaPy:        &fileInfo{exists: true, contents: []byte(schema)},
					schemaSql:       &fileInfo{exists: true, contents: []byte(sql)},
					versionsCount:   1,
					useVersionsInfo: true,
				}
			}
			before := info(tc.before, "metadata")
			after := info(tc.after, "metadata")
			if tc.changeSchema {
				after.schemaPy.contents = []byte("changed metadata")
			}
			processor := &codegen.Processor{Config: &codegen.Config{}}
			err := compareDbFilesInfo(processor, before, after)
			if tc.wantError == "" {
				require.NoError(t, err)
			} else {
				require.ErrorContains(t, err, tc.wantError)
			}
		})
	}
}
