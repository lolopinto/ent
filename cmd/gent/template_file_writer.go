package main

import "text/template"

type templatedBasedFileWriter struct {
	data               interface{}
	pathToTemplate     string
	templateName       string
	pathToFile         string
	createDirIfNeeded  bool
	checkForManualCode bool
	formatSource       bool
	funcMap            template.FuncMap
}

func (fw *templatedBasedFileWriter) CreateDirIfNeeded() bool {
	return fw.createDirIfNeeded
}

func (fw *templatedBasedFileWriter) GetPathToFile() string {
	return fw.pathToFile
}

func (fw *templatedBasedFileWriter) GenerateBytes() []byte {
	// parse existing file to see what we need to keep in the rewrite
	var config *astConfig

	// no real reason this only applies for just privacy.tmpl
	// but it's the only one where we care about this for now so limiting to just that
	// in the future, this should apply for all
	if fw.checkForManualCode {
		config = parseFileForManualCode(fw.pathToFile)
	}

	// generate the new AST we want for the file
	bytes := generateNewAst(fw)

	if config != nil {
		bytes = rewriteAstWithConfig(config, bytes)
	}
	return bytes
}
