package main

import (
	"fmt"
	"io/ioutil"
	"os"
	"path"
	"path/filepath"
)

type fileWriter interface {
	CreateDirIfNeeded() bool
	GetPathToFile() string
	GenerateBytes() []byte
}

func writeFile(fw fileWriter) {
	bytes := fw.GenerateBytes()
	pathToFile := fw.GetPathToFile()

	if fw.CreateDirIfNeeded() {
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
			die(err)
		}
	}

	err := ioutil.WriteFile(pathToFile, bytes, 0666)
	die(err)
	fmt.Println("wrote to file ", pathToFile)
}
