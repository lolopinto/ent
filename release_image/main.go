package main

import (
	"bytes"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path"
	"strings"
	"sync"

	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/file"
	"github.com/lolopinto/ent/internal/syncerr"
	"github.com/lolopinto/ent/internal/util"
	"github.com/pkg/errors"
)

// next tag to use
const TAG = "0.1.0-alpha.49-test3"

// current node gets latest tag...
const CURRENT_NODE_VERSION = 18
const REPO = "ghcr.io/lolopinto/ent"

const UPDATE_LATEST = true

var NODE_VERSIONS = []int{
	// 14,
	// 16,
	// 17,
	18,
}

const AUTO_SCHEMA_VERSION = "0.0.28"
const TSENT_VERSION = "v0.1.0-alpha.60"

var SUFFIXES = []string{
	"dev",
	// "slim",
}

// can change platforms here to test locally
var PLATFORMS = []string{
	// "linux/amd64",
	"linux/arm64",
}

var PACKAGE_MANAGERS = []string{
	"yarn",
	"npm",
}

func main() {
	var wg sync.WaitGroup
	wg.Add(len(NODE_VERSIONS) * len(SUFFIXES) * len(PACKAGE_MANAGERS))
	var serr syncerr.Error
	for i := range NODE_VERSIONS {
		for j := range SUFFIXES {
			for k := range PACKAGE_MANAGERS {
				go func(i, j, k int) {

					v := NODE_VERSIONS[i]
					suffix := SUFFIXES[j]
					pm := PACKAGE_MANAGERS[k]
					serr.Append(run(dockerfileData{
						NodeVersion:       v,
						DockerTag:         TAG,
						Suffix:            suffix,
						TsentVersion:      TSENT_VERSION,
						AutoSchemaVersion: AUTO_SCHEMA_VERSION,
						PackageManager:    pm,
					}, &wg))
				}(i, j, k)
			}
		}
	}
	wg.Wait()

	if err := serr.Err(); err != nil {
		log.Fatal(err)
	}
}

type dockerfileData struct {
	NodeVersion       int
	DockerTag         string
	Suffix            string
	TsentVersion      string
	AutoSchemaVersion string
	PackageManager    string
}

func (d *dockerfileData) create() bool {
	if d.Suffix == "dev" {
		return true
	}
	// only create in prod for npm since the npm vs yarn difference only applies in dev
	return d.PackageManager == "npm"
}

func (d *dockerfileData) Development() bool {
	return d.Suffix == "dev"
}

func (d *dockerfileData) Npm() bool {
	return d.PackageManager == "npm"
}

func (d *dockerfileData) Yarn() bool {
	return d.PackageManager == "yarn"
}

func (d *dockerfileData) updateLatest() bool {
	// current node/npm development gets latest since it should have full ish
	return d.NodeVersion == CURRENT_NODE_VERSION && UPDATE_LATEST && d.Development() && d.Npm()

}

func (d *dockerfileData) getTags() []string {
	ret := []string{}

	if d.Npm() {
		// image for npm doesn't have the package manager in the tag
		ret = append(ret, fmt.Sprintf("%s:%s-nodejs-%d-%s", REPO, TAG, d.NodeVersion, d.Suffix))
	} else {
		ret = append(ret, fmt.Sprintf("%s:%s-nodejs-%d-%s-%s", REPO, TAG, d.NodeVersion, d.Suffix, d.PackageManager))
	}

	if d.updateLatest() {
		ret = append(ret, fmt.Sprintf("%s:latest", REPO))
	}
	return ret
}

func createDockerfile(path string, d dockerfileData) error {
	cfg, err := codegen.NewConfig("src/schema", "")
	if err != nil {
		return err
	}
	return file.Write((&file.TemplatedBasedFileWriter{
		Config:            cfg,
		Data:              &d,
		AbsPathToTemplate: util.GetAbsolutePath("../ts/Dockerfile.tmpl"),
		TemplateName:      "Dockerfile.tmpl",
		PathToFile:        path,
	}))
}

func getCommandArgs(d dockerfileData, builder string) []string {
	cacheTag := fmt.Sprintf("%s:cache-nodejs%d", REPO, d.NodeVersion)
	tags := d.getTags()
	ret := []string{
		"buildx",
		"build",
		"--builder",
		builder,
		"--platform",
		strings.Join(PLATFORMS, ","),
		"--cache-from",
		fmt.Sprintf("type=registry,ref=%s", cacheTag),
		"--cache-to",
		fmt.Sprintf("type=registry,mode=max,ref=%s", cacheTag),
		"--push",
	}

	for _, tag := range tags {
		ret = append(ret, "--tag")
		ret = append(ret, tag)
	}

	ret = append(ret, "--push", ".")
	return ret
}

func run(d dockerfileData, wg *sync.WaitGroup) error {
	defer wg.Done()

	if !d.create() {
		return nil
	}

	dir := fmt.Sprintf("node_%d_%s_%s", d.NodeVersion, d.Suffix, d.PackageManager)
	info, err := os.Stat(dir)
	if err == nil {
		if !info.IsDir() {
			return errors.Wrapf(err, "path %s exists and is not a directory", dir)
		}
	} else if os.IsNotExist(err) {
		// only create if directory doesn't exist
		err := os.Mkdir(dir, os.ModePerm)
		if err != nil {
			return errors.Wrap(err, "error creating directory")
		}
	} else {
		return errors.Wrap(err, "unexpected error")
	}

	defer os.RemoveAll(dir)
	dockerfile := path.Join(dir, "Dockerfile")

	err = createDockerfile(dockerfile, d)

	if err != nil {
		return errors.Wrap(err, "error creating docker file")
	}

	// create new builder to user here
	var out bytes.Buffer
	buildCommand := exec.Command("docker", "buildx", "create", "--use")
	buildCommand.Stderr = os.Stderr
	buildCommand.Stdout = &out
	if err := buildCommand.Run(); err != nil {
		return errors.Wrap(err, "error creating builder")
	}
	builder := strings.TrimSpace(out.String())

	defer func() {
		// remove builder
		cleanupCmd := exec.Command("docker", "buildx", "rm", builder)
		cleanupCmd.Stdout = os.Stdout
		cleanupCmd.Stderr = os.Stderr
		err = cleanupCmd.Run()
		if err != nil {
			log.Println(err, "error cleaning up docker builder instance")
		}
	}()

	// build image
	cmd := exec.Command("docker", getCommandArgs(d, builder)...)
	cmd.Dir = dir
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	err = cmd.Run()
	if err != nil {
		return errors.Wrapf(err, "error building docker image %d-%s", d.NodeVersion, d.Suffix)
	}

	return nil
}
