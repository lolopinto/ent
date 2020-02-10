package file

import (
	"io/ioutil"
	"log"
	"os"
	"path"
	"path/filepath"
)

type Writer interface {
	Write(opts ...func(opt *Options)) error
	createDirIfNeeded() bool
	getPathToFile() string
	generateBytes() ([]byte, error)
}

func writeFile(w Writer, opts ...func(opt *Options)) error {
	option := &Options{}
	for _, opt := range opts {
		if opt == nil {
			continue
		}
		opt(option)
	}
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
				log.Println("created directory ", directoryPath)
			}
		}
		if os.IsNotExist(err) {
			return err
		}
	}

	if option.writeOnce {
		_, err := os.Stat(pathToFile)
		if err == nil {
			log.Printf("file %s already exists so not writing\n", pathToFile)
			return nil
		}
		if !os.IsNotExist(err) {
			log.Printf("error checking to see if path %s exists \n", pathToFile)
			return err
		}
	}
	err = ioutil.WriteFile(pathToFile, bytes, 0666)
	if err == nil {
		log.Println("wrote to file ", pathToFile)
	}
	return err
}

// Options provides a way to configure the file writing process as needed
// TODO: maybe move things like createDirIfNeeded to here?
type Options struct {
	writeOnce bool
}

// WriteOnce specifes that writing to path provided should not occur if the file already exists
// This is usually configured via code
func WriteOnce() func(opt *Options) {
	return func(opt *Options) {
		opt.writeOnce = true
	}
}

// WriteOnceMaybe takes a flag (usually provided via user action) and determines if we should add
// the writeOnce flag to Options
func WriteOnceMaybe(forceOverwrite bool) func(opt *Options) {
	if forceOverwrite {
		return nil
	}
	return WriteOnce()
}

func Write(w Writer, opts ...func(opt *Options)) error {
	return w.Write(opts...)
}
