package main

import (
	"fmt"
	"io/ioutil"
	"os"
	"regexp"

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

	// have to use an "absolute" filepath for now
	// TODO eventually use ParseDir... and *config.go
	//parser.Parse
	// get root path, find config files in there
	rootPath := path
	fileInfos, err := ioutil.ReadDir(rootPath)
	die(err)
	r, err := regexp.Compile("([a-z_]+)_config.go")
	die(err)

	for _, fileInfo := range fileInfos {
		match := r.FindStringSubmatch(fileInfo.Name())

		if len(match) == 2 {

			//fmt.Printf("config file Name %v \n", fileInfo.Name())
			//files = append(files, fileInfo.Name())

			packageName := match[1]
			filePath := rootPath + "/" + fileInfo.Name()

			fmt.Println(packageName, filePath)

			codegenPackage(packageName, filePath, specificConfig)
		} else {
			fmt.Println("invalid non-config file found:", fileInfo.Name())
		}
		//fmt.Printf("IsDir %v Name %v \n", fileInfo.IsDir(), fileInfo.Name())
	}
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
