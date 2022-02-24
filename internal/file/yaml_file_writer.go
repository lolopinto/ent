package file

import (
	yaml "gopkg.in/yaml.v3"
)

type YamlFileWriter struct {
	Config            Config
	Data              interface{}
	PathToFile        string
	CreateDirIfNeeded bool
}

func (fw *YamlFileWriter) createDirIfNeeded() bool {
	return fw.CreateDirIfNeeded
}

func (fw *YamlFileWriter) getPathToFile() string {
	return fw.PathToFile
}

func (fw *YamlFileWriter) generateBytes() ([]byte, error) {
	return yaml.Marshal(fw.Data)
}

func (fw *YamlFileWriter) Write(opts ...func(opt *Options)) error {
	return writeFile(fw, fw.Config, opts...)
}
