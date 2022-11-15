package file

import (
	"fmt"
	"os"
	"path"
	"path/filepath"
	"strings"
)

type Config interface {
	DebugMode() bool
	DebugFilesMode() bool
	GeneratedHeader() string
	AddChangedFile(file string)
	// doesn't actually writes the files, just keeps track of which files were going to be written
	// used to detect dangling files...
	DummyWrite() bool
}

type Writer interface {
	Write(opts ...func(opt *Options)) error
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

func writeFile(w Writer, cfg Config, opts ...func(opt *Options)) error {
	option := &Options{}
	if !cfg.DebugFilesMode() {
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
	if !filepath.IsAbs(fullPath) {
		// TODO need to convert everything here to absolute paths
		fullPath = filepath.Join(".", pathToFile)
	}
	directoryPath := path.Dir(fullPath)

	_, err = os.Stat(directoryPath)

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

	if cfg.DummyWrite() {
		err = nil
	} else {
		// skip writing
		err = os.WriteFile(fullPath, b, 0666)
	}

	if !option.disableLog {
		if err == nil {
			debugLogInfo(option, "wrote to file %s", pathToFile)
		}
	}

	if err == nil && !option.tempFile && strings.HasSuffix(fullPath, ".ts") {
		cfg.AddChangedFile(fullPath)
	}
	return err
}

func Write(w Writer, opts ...func(opt *Options)) error {
	return w.Write(opts...)
}
