package file

import (
	"fmt"
	"io/ioutil"
	"os"
	"path"
	"path/filepath"

	"github.com/lolopinto/ent/internal/util"
)

type Writer interface {
	Write()
	createDirIfNeeded() bool
	getPathToFile() string
	generateBytes() []byte
}

func writeFile(w Writer) {
	bytes := w.generateBytes()
	pathToFile := w.getPathToFile()

	if w.createDirIfNeeded() {
		fullPath := filepath.Join(".", pathToFile)
		directoryPath := path.Dir(fullPath)

		_, err := os.Stat(directoryPath)

		if os.IsNotExist(err) {
			err = os.MkdirAll(directoryPath, os.ModePerm)
			if err == nil {
				fmt.Println("created directory ", directoryPath)
			}
		}
		if os.IsNotExist(err) {
			util.Die(err)
		}
	}

	err := ioutil.WriteFile(pathToFile, bytes, 0666)
	util.Die(err)
	fmt.Println("wrote to file ", pathToFile)
}

func Write(w Writer) {
	w.Write()
}
