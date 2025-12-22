package testingutils

import (
	"encoding/json"

	"github.com/pkg/errors"
)

func DefaultCompilerOptions() string {
	opts, err := json.Marshal(map[string]interface{}{
		"lib":                []string{"esnext"},
		"module":             "nodenext",
		"target":             "es2020",
		"moduleResolution":   "nodenext",
		"downlevelIteration": true,
		"esModuleInterop":    true,
	})
	if err != nil {
		panic(errors.Wrap(err, "error creating json compiler options"))
	}
	return string(opts)
}
