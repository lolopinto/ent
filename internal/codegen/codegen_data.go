package codegen

import (
	"errors"

	"github.com/lolopinto/ent/internal/schema"
)

// Data stores the parsed data needed for codegen
type Data struct {
	Schema   *schema.Schema
	CodePath *CodePath
}

// Step refers to a step in the codegen process
// e.g. db/ graphql/code etc
type Step interface {
	Name() string
	ProcessData(data *Data) error
}

// given a sequence of steps, it runs the steps in the order that's given
func RunSteps(data *Data, steps []Step, step string) error {
	if step != "" {
		for _, s := range steps {
			if s.Name() == step {
				steps = []Step{s}
				break
			}
		}
		if len(steps) != 1 {
			return errors.New("invalid step passed")
		}
	}

	for _, s := range steps {
		if err := s.ProcessData(data); err != nil {
			return err
		}
	}
	return nil
}
