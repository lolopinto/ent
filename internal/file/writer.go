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

type statInfo struct {
	fileInfo *os.FileInfo
	err      error
}

type Writer interface {
	Write(opts ...func(opt *Options)) error
	createDirIfNeeded() bool
	getPathToFile() string
	generateBytes(opt *Options, si *statInfo) ([]byte, error)
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

	fileInfo, err := os.Stat(pathToFile)
	// if write once and file already exists, nothing to do here, we're done
	if option.writeOnce {
		if err == nil {
			debugLogInfo(option, "file %s already exists so not writing", pathToFile)
			return nil
		}
		if !os.IsNotExist(err) {
			debugLogInfo(option, "error checking to see if path %s exists \n", pathToFile)
			return err
		}
	}

	b, err := w.generateBytes(option, &statInfo{
		fileInfo: &fileInfo,
		err:      err,
	})
	if err != nil {
		return err
	}

	if b == nil {
		// nothing to do here
		return nil
	}

	if !option.tempFile && strings.HasSuffix(fullPath, ".ts") {
		codegen.AddChangedFile(fullPath)
	}

	err = ioutil.WriteFile(fullPath, b, 0666)
	if !option.disableLog {
		if err == nil {
			debugLogInfo(option, "wrote to file %s", pathToFile)
		}
	}
	return err
}

func Write(w Writer, opts ...func(opt *Options)) error {
	return w.Write(opts...)
}
