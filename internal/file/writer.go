package file

import (
	"fmt"
	"io/ioutil"
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

var globalOpt Options

func SetGlobalLogStatus(log bool) {
	globalOpt.disableLog = !log
}

func debugLogInfo(opt *Options, str string, a ...interface{}) {
	if opt.disableLog || globalOpt.disableLog {
		return
	}
	if len(a) == 0 {
		fmt.Printf(str + "\n")
	} else {
		fmt.Printf(str+"\n", a...)
	}
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
				debugLogInfo(option, "created directory ", directoryPath)
			} else {
				return err
			}
		}
		if os.IsNotExist(err) {
			return err
		}
	}

	if option.writeOnce {
		_, err := os.Stat(pathToFile)
		if err == nil {
			debugLogInfo(option, "file %s already exists so not writing", pathToFile)
			return nil
		}
		if !os.IsNotExist(err) {
			debugLogInfo(option, "error checking to see if path %s exists \n", pathToFile)
			return err
		}
	}
	err = ioutil.WriteFile(pathToFile, bytes, 0666)
	if !option.disableLog {
		if err == nil {
			debugLogInfo(option, "wrote to file %s", pathToFile)
		}
	}
	return err
}

// Options provides a way to configure the file writing process as needed
// TODO: maybe move things like createDirIfNeeded to here?
type Options struct {
	writeOnce  bool
	disableLog bool
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

// DisableLog disables the log that the file was written
func DisableLog() func(opt *Options) {
	return func(opt *Options) {
		opt.disableLog = true
	}
}

func Write(w Writer, opts ...func(opt *Options)) error {
	return w.Write(opts...)
}
