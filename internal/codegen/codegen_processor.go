package codegen

import (
	"errors"

	"github.com/lolopinto/ent/internal/schema"
)

// CodegenProcessor stores the parsed data needed for codegen
// this needs a new name
// CodegenProcessor?
type CodegenProcessor struct {
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

func (cp *CodegenProcessor) Run(steps []Step, step string, options ...Option) error {
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
			return errors.New("invalid step passed")
		}
	}

	for _, s := range steps {
		ps, ok := s.(StepWithPreProcess)
		if !ok {
			continue
		}
		if err := ps.PreProcessData(cp); err != nil {
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
	ProcessData(data *CodegenProcessor) error
}

type StepWithPreProcess interface {
	Step
	// any pre-process steps can be done here
	// this is where things like user input and other
	PreProcessData(data *CodegenProcessor) error
}

func NewCodegenProcessor(schema *schema.Schema, configPath, modulePath string) (*CodegenProcessor, error) {
	codePathInfo, err := NewCodePath(configPath, modulePath)
	if err != nil {
		return nil, err
	}

	data := &CodegenProcessor{
		Schema:   schema,
		CodePath: codePathInfo,
	}

	return data, nil
}
