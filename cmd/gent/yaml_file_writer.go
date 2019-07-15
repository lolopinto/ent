package main

import (
	"github.com/lolopinto/ent/internal/util"
	yaml "gopkg.in/yaml.v3"
)

type yamlFileWriter struct {
	data              map[interface{}]interface{}
	pathToFile        string
	createDirIfNeeded bool
}

func (fw *yamlFileWriter) CreateDirIfNeeded() bool {
	return fw.createDirIfNeeded
}

func (fw *yamlFileWriter) GetPathToFile() string {
	return fw.pathToFile
}

func (fw *yamlFileWriter) GenerateBytes() []byte {
	d, err := yaml.Marshal(fw.data)
	util.Die(err)
	//fmt.Println(string(d))

	return d
}
