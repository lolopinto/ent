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

	"github.com/lolopinto/ent/internal/file"
	"github.com/lolopinto/ent/internal/tsimport"
	"github.com/lolopinto/ent/internal/util"
	"github.com/pkg/errors"
)

// next tag
const TAG = "0.0.20"

// if current node gets latest tag...
const CURRENT_NODE_VERSION = 16
const REPO = "ghcr.io/lolopinto/ent"

const UPDATE_LATEST = true

var NODE_VERSIONS = []int{
	// 14,
	// 15,
	16,
}

const AUTO_SCHEMA_VERSION = "0.0.7"
const TSENT_VERSION = "v0.0.19"

var SUFFIXES = []string{
	"dev",
	"slim",
}

// can change platforms here to test locally
var PLATFORMS = []string{
	//	"linux/amd64",
	"linux/arm64",
}

func main() {
	var wg sync.WaitGroup
	wg.Add(len(NODE_VERSIONS) * len(SUFFIXES))
	errs := make([]error, len(NODE_VERSIONS)*len(SUFFIXES))
	for i := range NODE_VERSIONS {
		for j := range SUFFIXES {
			go func(i, j int) {
				defer wg.Done()
				v := NODE_VERSIONS[i]
				suffix := SUFFIXES[j]
				errs[i*len(SUFFIXES)+j] = <-run(dockerfileData{
					NodeVersion:       v,
					Suffix:            suffix,
					TsentVersion:      TSENT_VERSION,
					AutoSchemaVersion: AUTO_SCHEMA_VERSION,
				})
			}(i, j)
		}
	}
	wg.Wait()

	if err := util.CoalesceErr(errs...); err != nil {
		log.Fatal(err)
	}
}

type dockerfileData struct {
	NodeVersion       int
	Suffix            string
	TsentVersion      string
	AutoSchemaVersion string
}

func (d *dockerfileData) Development() bool {
	return d.Suffix == "dev"
}

func createDockerfile(path string, d dockerfileData) error {
	imps := tsimport.NewImports()

	return file.Write((&file.TemplatedBasedFileWriter{
		Data:              &d,
		CreateDirIfNeeded: true,
		AbsPathToTemplate: util.GetAbsolutePath("../ts/Dockerfile.tmpl"),
		TemplateName:      "Dockerfile.tmpl",
		PathToFile:        path,
		TsImports:         imps,
		FuncMap:           imps.FuncMap(),
	}))
}

func getTags(d dockerfileData) []string {
	ret := []string{
		fmt.Sprintf("%s:%s-nodejs-%d-%s", REPO, TAG, d.NodeVersion, d.Suffix),
	}
	if d.NodeVersion == CURRENT_NODE_VERSION && UPDATE_LATEST {
		ret = append(ret, fmt.Sprintf("%s:latest", REPO))
	}
	return ret
}

func getCommandArgs(d dockerfileData, builder string) []string {
	// cache image based on tsent and auto_schema
	// is that enough?
	cacheTag := fmt.Sprintf("%s:cache-%s-%s", REPO, TSENT_VERSION, AUTO_SCHEMA_VERSION)
	tags := getTags(d)
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

func run(d dockerfileData) <-chan error {
	c := make(chan error)
	go func() {
		dir := fmt.Sprintf("node_%d_%s", d.NodeVersion, d.Suffix)
		info, err := os.Stat(dir)
		if err == nil {
			if !info.IsDir() {
				c <- errors.Wrapf(err, "path %s exists and is not a directory", dir)
			}
		} else if os.IsNotExist(err) {
			// only create if directory exists
			err := os.Mkdir(dir, os.ModePerm)
			if err != nil {
				c <- errors.Wrap(err, "error creating directory")
				return
			}
		} else {
			c <- errors.Wrap(err, "unexpected error")
		}

		defer os.RemoveAll(dir)
		dockerfile := path.Join(dir, "Dockerfile")

		err = createDockerfile(dockerfile, d)

		if err != nil {
			c <- errors.Wrap(err, "error creating docker file")
			return
		}

		// create new builder to user here
		var out bytes.Buffer
		buildCommand := exec.Command("docker", "buildx", "create", "--use")
		buildCommand.Stderr = os.Stderr
		buildCommand.Stdout = &out
		if err := buildCommand.Run(); err != nil {
			c <- errors.Wrap(err, "error creating builder")
			log.Fatal(err)
		}
		builder := strings.TrimSpace(out.String())

		// build image
		cmd := exec.Command("docker", getCommandArgs(d, builder)...)
		cmd.Dir = dir
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		err = cmd.Run()
		if err != nil {
			c <- errors.Wrap(err, "error running docker command")
			return
		}

		// remove builder
		cleanupCmd := exec.Command("docker", "buildx", "rm", builder)
		cleanupCmd.Stdout = os.Stdout
		cleanupCmd.Stderr = os.Stderr
		err = cleanupCmd.Run()
		if err != nil {
			c <- errors.Wrap(err, "error cleaning up docker builder instance")
			return
		}

		c <- nil
	}()
	return c
}
