package codegen

import (
	"bytes"
	"fmt"
	"os/exec"
	"sync"
	"time"

	"github.com/lolopinto/ent/internal/file"
	"github.com/lolopinto/ent/internal/schema"
	"github.com/lolopinto/ent/internal/syncerr"
	"github.com/pkg/errors"
)

type option struct {
	disablePrompts bool
	disableFormat  bool
}

type Option func(*option)

func DisablePrompts() Option {
	return func(opt *option) {
		opt.disablePrompts = true
	}
}

func DisableFormat() Option {
	return func(opt *option) {
		opt.disableFormat = true
	}
}

// Processor stores the parsed data needed for codegen
type Processor struct {
	Schema    *schema.Schema
	Config    *Config
	debugMode bool
	opt       *option
}

func (p *Processor) Run(steps []Step, step string, options ...Option) error {
	opt := &option{}
	for _, o := range options {
		o(opt)
	}
	p.opt = opt

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
				err := runAndLog(p, ps.PreProcessData, func(d time.Duration) {
					fmt.Printf("pre-process step %s took %v \n", ps.Name(), d)
				})
				serr.Append(err)
			}(i)
		}

		wg.Wait()

		if err := serr.Err(); err != nil {
			return err
		}
	}

	if !opt.disablePrompts {
		if err := runAndLog(p, checkAndHandlePrompts, func(d time.Duration) {
			fmt.Printf("check and handle prompts step took %v \n", d)
		}); err != nil {
			return err
		}
	}

	for _, s := range steps {
		if err := runAndLog(p, s.ProcessData, func(d time.Duration) {
			fmt.Printf("process step %s took %v \n", s.Name(), d)
		}); err != nil {
			return err
		}
	}

	return runAndLog(p, postProcess, func(d time.Duration) {
		fmt.Printf("post-process step took %v \n", d)
	})
}

func (p *Processor) FormatTS() error {
	cmd := exec.Command("prettier", p.Config.GetPrettierArgs()...)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		str := stderr.String()
		err = errors.Wrap(err, str)
		return err
	}
	return nil
}

func postProcess(p *Processor) error {
	if p.opt.disableFormat {
		return nil
	}
	return p.FormatTS()
}

func runAndLog(p *Processor, fn func(p *Processor) error, logDiff func(d time.Duration)) error {
	if !p.debugMode {
		return fn(p)
	}
	t1 := time.Now()
	err := fn(p)
	t2 := time.Now()
	diff := t2.Sub(t1)
	logDiff(diff)
	return err
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

func NewCodegenProcessor(schema *schema.Schema, configPath, modulePath string, debugMode bool) (*Processor, error) {
	cfg, err := NewConfig(configPath, modulePath)
	if err != nil {
		return nil, err
	}

	processor := &Processor{
		Schema:    schema,
		Config:    cfg,
		debugMode: debugMode,
	}

	// if in debug mode can log things
	file.SetGlobalLogStatus(debugMode)
	return processor, nil
}

func FormatTS(cfg *Config) error {
	p := &Processor{
		Config: cfg,
	}
	return p.FormatTS()
}
