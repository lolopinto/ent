package codegen

import (
	"fmt"
	"sync"

	"github.com/lolopinto/ent/internal/schema"
	"github.com/lolopinto/ent/internal/syncerr"
)

// Processor stores the parsed data needed for codegen
// this needs a new name
// Processor?
type Processor struct {
	Schema   *schema.Schema
	CodePath *CodePath
}

type option struct {
	disablePrompts bool
}

type Option func(*option)

func DisablePrompts() Option {
	return func(opt *option) {
		opt.disablePrompts = true
	}
}

func (cp *Processor) Run(steps []Step, step string, options ...Option) error {
	opt := &option{}
	for _, o := range options {
		o(opt)
	}

	if step != "" {
		for _, s := range steps {
			if s.Name() == step {
				steps = []Step{s}
				break
			}
		}
		if len(steps) != 1 {
			return fmt.Errorf("invalid step %s passed", step)
		}
	}

	var pre_steps []StepWithPreProcess
	for _, s := range steps {
		ps, ok := s.(StepWithPreProcess)
		if ok {
			pre_steps = append(pre_steps, ps)
		}
	}

	if len(pre_steps) > 0 {
		var wg sync.WaitGroup
		wg.Add(len(pre_steps))
		var serr syncerr.Error

		for i := range pre_steps {
			go func(i int) {
				defer wg.Done()
				ps := pre_steps[i]
				serr.Append(ps.PreProcessData(cp))
			}(i)
		}

		wg.Wait()

		if err := serr.Err(); err != nil {
			return err
		}
	}

	if !opt.disablePrompts {
		if err := checkAndHandlePrompts(cp.Schema, cp.CodePath); err != nil {
			return err
		}
	}

	// TODO refactor these from being called sequentially to something that can be called in parallel
	// Right now, they're being called sequentially
	// I don't see any reason why some can't be done in parrallel
	// 0/ generate consts. has to block everything (not a plugin could be?) however blocking
	// 1/ db
	// 2/ create new nodes (blocked by db) since assoc_edge_config table may not exist yet
	// 3/ model files. should be able to run on its own
	// 4/ graphql should be able to run on its own

	for _, s := range steps {
		if err := s.ProcessData(cp); err != nil {
			return err
		}
	}

	return nil
}

// Step refers to a step in the codegen process
// e.g. db/ graphql/code etc
type Step interface {
	Name() string
	ProcessData(data *Processor) error
}

type StepWithPreProcess interface {
	Step
	// any pre-process steps can be done here
	// this is where things like user input and other
	PreProcessData(data *Processor) error
}

func NewCodegenProcessor(schema *schema.Schema, configPath, modulePath string) (*Processor, error) {
	codePathInfo, err := NewCodePath(configPath, modulePath)
	if err != nil {
		return nil, err
	}

	data := &Processor{
		Schema:   schema,
		CodePath: codePathInfo,
	}

	return data, nil
}
