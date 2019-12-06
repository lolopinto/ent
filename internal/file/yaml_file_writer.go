package file

import (
	"github.com/lolopinto/ent/internal/util"
	yaml "gopkg.in/yaml.v3"
)

type YamlFileWriter struct {
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

func (fw *YamlFileWriter) generateBytes() []byte {
	d, err := yaml.Marshal(fw.Data)
	util.Die(err)
	//fmt.Println(string(d))

	return d
}

func (fw *YamlFileWriter) Write() {
	writeFile(fw)
}
