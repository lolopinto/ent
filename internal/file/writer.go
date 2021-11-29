package file

import (
	"fmt"
	"io/ioutil"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/lolopinto/ent/internal/codegen"
)

type Writer interface {
	Write(opts ...func(opt *Options)) error
	createDirIfNeeded() bool
	getPathToFile() string
	generateBytes() ([]byte, error)
}

func debugLogInfo(opt *Options, str string, a ...interface{}) {
	if opt.disableLog {
		return
	}
	if len(a) == 0 {
		fmt.Printf(str + "\n")
	} else {
		fmt.Printf(str+"\n", a...)
	}
}

func writeFile(w Writer, cfg *codegen.Config, opts ...func(opt *Options)) error {
	option := &Options{}
	if cfg.DebugMode() {
		opts = append(opts, DisableLog())
	}
	for _, opt := range opts {
		if opt == nil {
			continue
		}
		opt(option)
	}
	pathToFile := w.getPathToFile()
	if option.writeOnce {
		idx := strings.Index(pathToFile, "generated")
		if idx != -1 {
			fmt.Printf("WARN: file %s which is being written once has generated in the name...\n", pathToFile)
		}
	}
	b, err := w.generateBytes()
	if err != nil {
		return err
	}

	fullPath := pathToFile
	if w.createDirIfNeeded() {
		if !filepath.IsAbs(fullPath) {
			// TODO need to convert everything here to absolute paths
			fullPath = filepath.Join(".", pathToFile)
		}
		directoryPath := path.Dir(fullPath)

		_, err := os.Stat(directoryPath)

		if os.IsNotExist(err) {
			err = os.MkdirAll(directoryPath, os.ModePerm)
			if err == nil {
				debugLogInfo(option, "created directory "+directoryPath)
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

	err = ioutil.WriteFile(fullPath, b, 0666)
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
