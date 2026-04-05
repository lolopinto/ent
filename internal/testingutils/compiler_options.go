package testingutils

import (
	"encoding/json"
	"fmt"
)

func DefaultCompilerOptions() string {
	opts, err := json.Marshal(map[string]interface{}{
		"lib":                []string{"esnext"},
		"module":             "commonjs",
		"target":             "es2020",
		"moduleResolution":   "node",
		"downlevelIteration": true,
		"esModuleInterop":    true,
	})
	if err != nil {
		panic(fmt.Errorf("error creating json compiler options: %w", err))
	}
	return string(opts)
}
