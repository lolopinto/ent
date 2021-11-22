package codegen

import (
	"bytes"
	"fmt"
	"os/exec"
	"strings"
	"sync"
	"time"

	"github.com/lolopinto/ent/internal/schema"
	"github.com/lolopinto/ent/internal/syncerr"
	"github.com/pkg/errors"
)

type option struct {
	disablePrompts       bool
	disableFormat        bool
	disableCustomGraphQL bool
	fromTest             bool
	disableSchemaGQL     bool
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

func DisableCustomGraphQL() Option {
	return func(opt *option) {
		opt.disableCustomGraphQL = true
	}
}

func FromTest() Option {
	return func(opt *option) {
		opt.fromTest = true
	}
}

func DisableSchemaGQL() Option {
	return func(opt *option) {
		opt.disableSchemaGQL = true
	}
}

// Processor stores the parsed data needed for codegen
type Processor struct {
	Schema      *schema.Schema
	Config      *Config
	debugMode   bool
	opt         *option
	noDBChanges bool
}

func (p *Processor) NoDBChanges() bool {
	return p.noDBChanges
}

func (p *Processor) DisableCustomGraphQL() bool {
	if p.opt == nil {
		return false
	}
	return p.opt.disableCustomGraphQL
}

func (p *Processor) FromTest() bool {
	if p.opt == nil {
		return false
	}
	return p.opt.fromTest
}

func (p *Processor) DisableSchemaGQL() bool {
	if p.opt == nil {
		return false
	}
	return p.opt.disableSchemaGQL
}

func (p *Processor) Run(steps []Step, step string, options ...Option) error {
	for _, o := range options {
		o(p.opt)
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

	if !p.opt.disablePrompts {
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

// keep track of changed ts files to pass to prettier
var changedTSFiles []string

func AddChangedFile(filePath string) {
	if strings.HasSuffix(filePath, ".ts") {
		changedTSFiles = append(changedTSFiles, filePath)
	}
}

func (p *Processor) FormatTS() error {
	// no changed ts files. nothing to format
	if len(changedTSFiles) == 0 {
		if p.debugMode {
			fmt.Printf("no changed files\n")
		}
		return nil
	}
	cmd := exec.Command("prettier", p.Config.GetPrettierArgs(changedTSFiles)...)
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
	if p.opt != nil && p.opt.disableFormat {
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
	cfg.SetDebugMode(debugMode)

	return &Processor{
		Schema:    schema,
		Config:    cfg,
		debugMode: debugMode,
		opt:       &option{},
	}, nil
}

func NewTestCodegenProcessor(configPath string, s *schema.Schema, codegenCfg *CodegenConfig) (*Processor, error) {
	cfg, err := NewTestConfig(configPath, "", codegenCfg)
	if err != nil {
		return nil, err
	}
	return &Processor{
		Config: cfg,
		Schema: s,
		opt:    &option{},
	}, nil
}

func FormatTS(cfg *Config) error {
	p := &Processor{
		Config: cfg,
	}
	return p.FormatTS()
}
