package main

import (
	"fmt"
	"os"

	flag "github.com/ogier/pflag"
)

// flags
var (
	path           string
	specificConfig string
)

func init() {
	flag.StringVarP(&path, "path", "p", "", "Path of config files")
	flag.StringVarP(&specificConfig, "config", "c", "", "Specific EntConfig to codegen")
}

func main() {
	flag.Parse()

	printUsageIfNecessary()

	// absolute path
	// dir, err := filepath.Abs(filepath.Dir(os.Args[0]))
	// if err != nil {
	// 	log.Fatal(err)
	// }
	// fmt.Println(dir)

	parseSchemasAndGenerate(path, specificConfig)
}

func printUsageIfNecessary() {
	if flag.NFlag() == 0 {
		printOptions()
		os.Exit(1)
	} else if path == "" {
		printOptions()
		fmt.Println("Need to pass in path to config files")
		os.Exit(1)
	}
}

func printOptions() {
	fmt.Printf("Usage: %s [options]\n", os.Args[0])
	fmt.Println("Options:")
	flag.PrintDefaults()
}
