package codegen

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"sync"
	"time"

	"github.com/lolopinto/ent/internal/build_info"
	"github.com/lolopinto/ent/internal/file"
	"github.com/lolopinto/ent/internal/fns"
	"github.com/lolopinto/ent/internal/schema"
	"github.com/lolopinto/ent/internal/schema/base"
	"github.com/lolopinto/ent/internal/schema/change"
	"github.com/lolopinto/ent/internal/schema/input"
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
	ChangeMap   change.ChangeMap
	useChanges  bool
	Config      *Config
	debugMode   bool
	opt         *option
	buildInfo   *build_info.BuildInfo
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
	var post_steps []StepWithPostProcess

	for _, s := range steps {
		ps, ok := s.(StepWithPreProcess)
		if ok {
			pre_steps = append(pre_steps, ps)
		}
		ps2, ok := s.(StepWithPostProcess)
		if ok {
			post_steps = append(post_steps, ps2)
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

	if len(post_steps) > 0 {
		var wg sync.WaitGroup
		wg.Add(len(post_steps))
		var serr syncerr.Error

		for i := range post_steps {
			go func(i int) {
				defer wg.Done()
				ps := post_steps[i]
				err := runAndLog(p, ps.PostProcessData, func(d time.Duration) {
					fmt.Printf("post-process step %s took %v \n", ps.Name(), d)
				})
				serr.Append(err)
			}(i)
		}

		wg.Wait()

		if err := serr.Err(); err != nil {
			return err
		}
	}

	return runAndLog(p, postProcess, func(d time.Duration) {
		fmt.Printf("post-process step took %v \n", d)
	})
}

func (p *Processor) FormatTS() error {
	// nothing to do here
	args := p.Config.GetPrettierArgs()
	if args == nil {
		if p.debugMode {
			fmt.Printf("no files for prettier to format\n")
		}
		return nil
	}
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

func (p *Processor) WriteSchema() error {
	inputSchema := p.Schema.GetInputSchema()
	if inputSchema == nil {
		return nil
	}

	return file.Write(&file.JSONFileWriter{
		Config:     p.Config,
		Data:       inputSchema,
		PathToFile: p.Config.GetPathToSchemaFile(),
	})
}

func postProcess(p *Processor) error {
	if p.opt != nil && p.opt.disableFormat {
		return nil
	}

	return fns.RunVarargs(
		func() error {
			return p.WriteSchema()
		},
		func() error {
			return p.FormatTS()
		},
		func() error {
			if p.buildInfo != nil {
				return p.buildInfo.PostProcess()
			}
			return nil
		},
	)
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

// TODO figure out long term thing here
type StepWithPostProcess interface {
	Step
	PostProcessData(data *Processor) error
}

type constructOption struct {
	debugMode bool
	writeAll  bool
	buildInfo *build_info.BuildInfo
	cfg       *Config
}

type ConstructOption func(*constructOption)

func DebugMode() ConstructOption {
	return func(opt *constructOption) {
		opt.debugMode = true
	}
}

func BuildInfo(bi *build_info.BuildInfo) ConstructOption {
	return func(opt *constructOption) {
		opt.buildInfo = bi
	}
}

func ProcessorConfig(cfg *Config) ConstructOption {
	return func(opt *constructOption) {
		opt.cfg = cfg
	}
}

func WriteAll() ConstructOption {
	return func(opt *constructOption) {
		opt.writeAll = true
	}
}

func NewCodegenProcessor(currentSchema *schema.Schema, configPath string, options ...ConstructOption) (*Processor, error) {
	opt := &constructOption{}
	for _, o := range options {
		o(opt)
	}
	var cfg *Config
	if opt.cfg != nil {
		cfg = opt.cfg
	} else {
		var err error
		cfg, err = NewConfig(configPath, "")
		if err != nil {
			return nil, err
		}
	}
	cfg.SetDebugMode(opt.debugMode)

	existingSchema := parseExistingSchema(cfg)
	changes, err := schema.CompareSchemas(existingSchema, currentSchema)
	if err != nil && opt.debugMode {
		fmt.Printf("error %v comparing schemas \n", err)
	}
	// if changes == nil, don't use changes
	useChanges := changes != nil
	cfg.SetUseChanges(useChanges)
	writeAll := !useChanges || opt.writeAll
	if !writeAll && opt.buildInfo != nil && opt.buildInfo.Changed() {
		writeAll = true
	}
	cfg.SetWriteAll(writeAll)
	cfg.SetChangeMap(changes)

	return &Processor{
		Schema:     currentSchema,
		Config:     cfg,
		ChangeMap:  changes,
		useChanges: useChanges,
		debugMode:  opt.debugMode,
		opt:        &option{},
		buildInfo:  opt.buildInfo,
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

func parseExistingSchema(cfg *Config) *schema.Schema {
	filepath := cfg.GetPathToSchemaFile()
	fi, _ := os.Stat(filepath)
	if fi == nil {
		return nil
	}
	b, err := os.ReadFile(filepath)
	if err != nil {
		return nil
	}

	existingSchema, err := input.ParseSchema(b)
	if err != nil {
		return nil
	}
	s, _ := schema.ParseFromInputSchema(existingSchema, base.TypeScript)
	return s
}
