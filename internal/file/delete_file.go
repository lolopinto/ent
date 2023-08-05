package file

import (
	"fmt"
	"os"
)

func GetDeleteFileFunction(cfg Config, fileName string) func() error {
	return func() error {
		debug := cfg.DebugFilesMode()
		if debug {
			fmt.Printf("deleting file %s \n", fileName)
		}
		fi, err := os.Stat(fileName)
		if err == nil && fi.IsDir() {
			if err := os.RemoveAll(fileName); err != nil {
				if debug {
					fmt.Printf("error %v deleting directory %s", err, fileName)
				}
			}
			return nil
		}
		if err := os.Remove(fileName); err != nil {
			if debug {
				fmt.Printf("error %v deleting file %s", err, fileName)
			}
		}
		return nil
	}
}
