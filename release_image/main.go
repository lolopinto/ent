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
const TAG = "0.0.18"

// if current node gets latest tag...
const CURRENT_NODE_VERSION = 16
const REPO = "ghcr.io/lolopinto/ent"

const UPDATE_LATEST = true

var NODE_VERSIONS = []dockerfileData{
	//	{14, 6},
	{15, 6},
	//	{16, 7},
}

// can change platforms here to test locally
var PLATFORMS = []string{
	//"linux/amd64",
	"linux/arm64",
}

func main() {
	var wg sync.WaitGroup
	wg.Add(len(NODE_VERSIONS))
	errs := make([]error, len(NODE_VERSIONS))
	for i := range NODE_VERSIONS {
		go func(i int) {
			defer wg.Done()
			v := NODE_VERSIONS[i]
			errs[i] = <-run(v.NODE_VERSION, v.NPM_VERSION)
		}(i)
	}
	wg.Wait()

	if err := util.CoalesceErr(errs...); err != nil {
		log.Fatal(err)
	}
}

type dockerfileData struct {
	NODE_VERSION int
	NPM_VERSION  int
}

func createDockerfile(path string, d dockerfileData) error {
	imps := tsimport.NewImports()

	return file.Write((&file.TemplatedBasedFileWriter{
		Data:              d,
		CreateDirIfNeeded: true,
		AbsPathToTemplate: util.GetAbsolutePath("../ts/Dockerfile.tmpl"),
		TemplateName:      "Dockerfile.tmpl",
		PathToFile:        path,
		TsImports:         imps,
		FuncMap:           imps.FuncMap(),
	}))
}

func getTags(node int) []string {
	ret := []string{
		fmt.Sprintf("%s:%s-nodejs-%d", REPO, TAG, node),
	}
	if node == CURRENT_NODE_VERSION && UPDATE_LATEST {
		ret = append(ret, fmt.Sprintf("%s:latest", REPO))
	}
	return ret
}

func getCommandArgs(node int, builder string) []string {
	tags := getTags(node)
	ret := []string{
		"buildx",
		"build",
		"--builder",
		builder,
		"--platform",
		strings.Join(PLATFORMS, ","),
	}

	for _, tag := range tags {
		ret = append(ret, "--tag")
		ret = append(ret, tag)
	}

	ret = append(ret, "--push", ".")
	return ret
}

func run(node, npm int) <-chan error {
	c := make(chan error)
	go func() {
		dir := fmt.Sprintf("node_%d", node)
		err := os.Mkdir(dir, os.ModePerm)
		if err != nil {
			c <- errors.Wrap(err, "error creating directory")
			return
		}

		defer os.RemoveAll(dir)
		dockerfile := path.Join(dir, "Dockerfile")

		err = createDockerfile(dockerfile, dockerfileData{
			NODE_VERSION: node,
			NPM_VERSION:  npm,
		})
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
		cmd := exec.Command("docker", getCommandArgs(node, builder)...)
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
