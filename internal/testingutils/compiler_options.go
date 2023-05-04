package testingutils

import (
	"encoding/json"

	"github.com/pkg/errors"
)

func DefaultCompilerOptions() string {
	opts, err := json.Marshal(map[string]interface{}{
		"lib":                []string{"esnext", "dom"},
		"moduleResolution":   "node",
		"downlevelIteration": true,
		"esModuleInterop":    true,
	})
	if err != nil {
		panic(errors.Wrap(err, "error creating json compiler options"))
	}
	return string(opts)
}
