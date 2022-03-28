package build_info

import (
	"os"

	"github.com/lolopinto/ent/internal/file"
	"github.com/lolopinto/ent/internal/schema/change"
	"github.com/lolopinto/ent/internal/util"
	"gopkg.in/yaml.v3"
)

type BuildInfo struct {
	BuildTime     string `yaml:"buildTime"`
	ConfigTime    string `yaml:"configTime"` // ent.yml time
	DockerVersion string `yaml:"dockerVersion"`
	dev           bool   `yaml:"-"`
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
		BuildTime:     Time,
		DockerVersion: DockerVersion,
		cfg:           cfg,
	}

	simulProd := util.EnvIsTrue("CODEGEN_SIMULATE_PROD")
	simulDev := util.EnvIsTrue("CODEGEN_SIMULATE_DEV")
	if simulProd {
		// no
		bi.dev = false
	} else if simulDev {
		bi.dev = true
	} else {
		if bi.BuildTime == "" || bi.DockerVersion == "" {
			bi.dev = true
		}
	}

	// check ent.yml and store last time it was modified since changing it can change everything
	fi, err := os.Stat("ent.yml")
	if err == nil {
		bi.ConfigTime = fi.ModTime().String()
	}

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

func buildInfoEqual(bi1, bi2 *BuildInfo) bool {
	ret := change.CompareNilVals(bi1 == nil, bi2 == nil)
	if ret != nil {
		return *ret
	}
	return bi1.BuildTime == bi2.BuildTime &&
		bi1.DockerVersion == bi2.DockerVersion &&
		bi1.ConfigTime == bi2.ConfigTime
}
