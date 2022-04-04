package file

import (
	"fmt"
	"os"
)

func GetDeleteFileFunction(cfg Config, fileName string) func() error {
	return func() error {
		debug := cfg.DebugMode()
		if debug {
			fmt.Printf("deleting file %s \n", fileName)
		}
		if err := os.Remove(fileName); err != nil {
			if debug {
				fmt.Printf("error %v deleting file %s", err, fileName)
			}
		}
		return nil
	}
}
