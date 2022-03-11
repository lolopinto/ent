package build_info

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"strings"

	"github.com/lolopinto/ent/internal/codepath"
	"github.com/lolopinto/ent/internal/file"
	"github.com/lolopinto/ent/internal/schema/change"
	"github.com/lolopinto/ent/internal/util"
	"gopkg.in/yaml.v3"
)

// TODO need to compare this and use this to flag to codegen about writeAll
type BuildInfo struct {
	Time          string `yaml:"time"`
	DockerVersion string `yaml:"dockerVersion"`
	dev           bool   `yaml:"-"`
	NpmVersion    string `yaml:"npmVersion"`
	gitBranch     string `yaml:"-"`
	cfg           Config `yaml:"-"`
	prevEqual     bool   `yaml:"-"`
}

// flag as Changed
func (bi *BuildInfo) Changed() bool {
	return bi.dev || !bi.prevEqual
}

type Config interface {
	file.Config
	GetPathToBuildFile() string
}

// next 2 set via:
// go install -v -ldflags="-X 'github.com/lolopinto/ent/internal/build_info.DockerVersion=v0.ss' -X 'github.com/lolopinto/ent/internal/build_info.Time=$(date)'"

// DockerVersion encompasses go or auto_schema
var DockerVersion string

// if build time is same time...
var Time string

// CODEGEN_SIMULATE_DEV
// CODEGEN_SIMULATE_PROD

// compare with existing schema and write new one after
// bi.PostProcess
func NewBuildInfo(cfg Config) *BuildInfo {
	bi := &BuildInfo{
		Time:          Time,
		DockerVersion: DockerVersion,
		cfg:           cfg,
	}

	bi.NpmVersion = findNPMVersion()

	parts := strings.Split(bi.NpmVersion, " -> ")
	simulProd := util.EnvIsTrue("CODEGEN_SIMULATE_PROD")
	simulDev := util.EnvIsTrue("CODEGEN_SIMULATE_DEV")
	if simulProd {
		// no
		bi.dev = false
	} else if simulDev {
		bi.dev = true
	} else {
		// when we use npm link, the version is something like
		// 0.0.37 -> ./../../ts/dist
		if len(parts) > 1 ||
			(bi.Time == "" && bi.DockerVersion == "") {
			bi.dev = true
		}
	}
	bi.gitBranch = gitBranch()

	prev := loadPreviousBI(cfg)
	bi.prevEqual = buildInfoEqual(prev, bi)
	return bi
}

func loadPreviousBI(cfg Config) *BuildInfo {
	file := cfg.GetPathToBuildFile()
	fi, _ := os.Stat(file)
	if fi == nil {
		return nil
	}
	b, err := os.ReadFile(file)
	if err != nil {
		return nil
	}
	var bi BuildInfo
	err = yaml.Unmarshal(b, &bi)
	if err != nil {
		return nil
	}
	return &bi
}

func (bi *BuildInfo) PostProcess() error {
	return file.Write(&file.YamlFileWriter{
		Config:     bi.cfg,
		Data:       bi,
		PathToFile: bi.cfg.GetPathToBuildFile(),
	})
}

func runCommand(name string, args ...string) (*bytes.Buffer, error) {
	var buf bytes.Buffer
	var berr bytes.Buffer

	cmd := exec.Command(name, args...)
	cmd.Stdout = &buf
	cmd.Stderr = &berr
	if err := cmd.Run(); err != nil {
		return nil, err
	}
	if len(berr.String()) > 0 {
		return nil, fmt.Errorf("stderror %s", berr.String())
	}
	return &buf, nil
}

func findNPMVersion() string {
	buf, err := runCommand("npm", "list", codepath.Package, "--depth=0")
	if err != nil {
		// TODO log
		return ""
	}

	lines := strings.Split(strings.TrimSpace(buf.String()), "\n")
	if len(lines) != 2 {
		// TODO log. not as expected
		return ""
	}
	line := lines[1]
	idx := strings.LastIndex(line, "@")
	if idx == -1 || idx+1 >= len(line) {
		return ""
	}
	return line[idx+1:]
}

func gitBranch() string {
	// git rev-parse --abbrev-ref HEAD
	buf, err := runCommand("git", "rev-parse", "--abbrev-ref", "HEAD")
	if err != nil {
		// TODO log
		return ""
	}
	return strings.TrimSpace(buf.String())
}

func buildInfoEqual(bi1, bi2 *BuildInfo) bool {
	ret := change.CompareNilVals(bi1 == nil, bi2 == nil)
	if ret != nil {
		return *ret
	}
	return bi1.Time == bi2.Time &&
		bi1.DockerVersion == bi2.DockerVersion &&
		bi1.NpmVersion == bi2.NpmVersion
}
