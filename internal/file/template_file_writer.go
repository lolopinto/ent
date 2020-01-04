package file

import (
	"bytes"
	"fmt"
	"text/template"

	intimports "github.com/lolopinto/ent/internal/imports"
	"golang.org/x/tools/imports"
)

type TemplatedBasedFileWriter struct {
	Data              interface{}
	AbsPathToTemplate string
	TemplateName      string
	PathToFile        string
	CreateDirIfNeeded bool
	FormatSource      bool
	FuncMap           template.FuncMap
	PackageName       string
	//	manualImports      bool
	Imports *intimports.Imports
}

func (fw *TemplatedBasedFileWriter) createDirIfNeeded() bool {
	return fw.CreateDirIfNeeded
}

func (fw *TemplatedBasedFileWriter) getPathToFile() string {
	return fw.PathToFile
}

func (fw *TemplatedBasedFileWriter) generateBytes() ([]byte, error) {
	// generate the new AST we want for the file
	buf, err := fw.generateNewAst()
	if err != nil {
		return nil, err
	}

	// better flag needed. but basically not go code and we can bounce
	if !fw.FormatSource {
		return buf.Bytes(), nil
	}

	var b []byte
	if fw.Imports != nil {
		buf, err = fw.handleManualImports(buf)
		if err != nil {
			return nil, err
		}
	}

	b, err = imports.Process(
		fw.PathToFile,
		buf.Bytes(),
		&imports.Options{
			FormatOnly: false,
			Comments:   true,
			TabIndent:  true,
			TabWidth:   8,
		},
	)
	if err != nil {
		fmt.Println(string(buf.Bytes()))
	}

	return b, err
}

// TODO rename this since this is just parse template that's non-AST
// generate new AST for the given file from the template
func (fw *TemplatedBasedFileWriter) generateNewAst() (*bytes.Buffer, error) {
	path := []string{fw.AbsPathToTemplate}
	t := template.New(fw.TemplateName).Funcs(fw.FuncMap)
	t, err := t.ParseFiles(path...)
	if err != nil {
		return nil, err
	}

	var buffer bytes.Buffer

	// execute the template and store in buffer
	err = t.Execute(&buffer, fw.Data)
	return &buffer, err
}

func (fw *TemplatedBasedFileWriter) handleManualImports(buf *bytes.Buffer) (*bytes.Buffer, error) {
	var result bytes.Buffer
	result.WriteString("// Code generated by github.com/lolopinto/ent/ent, DO NOT EDIT.\n\n")

	result.WriteString("package ")
	result.WriteString(fw.PackageName)
	result.WriteString("\n\n")
	result.WriteString("import (\n")
	result.WriteString(fw.Imports.String())
	result.WriteString(")\n")
	_, err := buf.WriteTo(&result)

	return &result, err
}

func (fw *TemplatedBasedFileWriter) Write() error {
	return writeFile(fw)
}
