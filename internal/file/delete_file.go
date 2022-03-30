package file

import (
	"fmt"
	"os"
)

func GetDeleteFileFunction(cfg Config, fileName string) func() error {
	return func() error {
		if cfg.DebugMode() {
			fmt.Printf("deleting file %s \n", fileName)
		}
		return os.Remove(fileName)
	}
}
