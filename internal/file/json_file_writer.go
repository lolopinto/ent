package file

import (
	"encoding/json"
)

type JSONFileWriter struct {
	Config            Config
	Data              interface{}
	PathToFile        string
	CreateDirIfNeeded bool
}

func (fw *JSONFileWriter) createDirIfNeeded() bool {
	return fw.CreateDirIfNeeded
}

func (fw *JSONFileWriter) getPathToFile() string {
	return fw.PathToFile
}

func (fw *JSONFileWriter) generateBytes() ([]byte, error) {
	return json.Marshal(fw.Data)
}

func (fw *JSONFileWriter) Write(opts ...func(opt *Options)) error {
	return writeFile(fw, fw.Config, opts...)
}
