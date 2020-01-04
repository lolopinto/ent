package file

import (
	"fmt"
	"io/ioutil"
	"log"
	"os"
	"path"
	"path/filepath"
)

type Writer interface {
	Write() error
	createDirIfNeeded() bool
	getPathToFile() string
	generateBytes() ([]byte, error)
}

func writeFile(w Writer) error {
	bytes, err := w.generateBytes()
	if err != nil {
		return err
	}
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
			return err
		}
	}

	err = ioutil.WriteFile(pathToFile, bytes, 0666)
	if err != nil {
		log.Println("wrote to file ", pathToFile)
	}
	return err
}

func Write(w Writer) error {
	return w.Write()
}
