package file

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"sync"
	"text/template"

	"github.com/evanw/esbuild/pkg/api"
	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/filehelper"
	intimports "github.com/lolopinto/ent/internal/imports"
	"github.com/lolopinto/ent/internal/tsimport"
	"golang.org/x/tools/imports"
)

type TemplatedBasedFileWriter struct {
	Data               interface{}
	AbsPathToTemplate  string
	OtherTemplateFiles []string // should also be an absolute path
	TemplateName       string
	PathToFile         string
	CreateDirIfNeeded  bool
	FuncMap            template.FuncMap
	PackageName        string
	Imports            *intimports.Imports
	TsImports          *tsimport.Imports
	Config             *codegen.Config
	EditableCode       bool
}

var target api.Target
var targetErr error
var once sync.Once

type tsconfigStruct struct {
	CompilerOptions struct {
		Target string `json:"target"`
	} `json:"compilerOptions"`
}

func findApiTarget(filePath string) (api.Target, error) {
	once.Do(func() {
		target = api.DefaultTarget
		result := filehelper.FindAndRead(filePath, "tsconfig.json")
		b := result.Bytes
		err := result.Error
		if err != nil {
			targetErr = err
			return
		}
		if b == nil {
			targetErr = fmt.Errorf("no tsconfig.json found")
			return
		}
		tsc := &tsconfigStruct{}
		if err := json.Unmarshal(b, tsc); err != nil {
			targetErr = err
			return
		}
		switch strings.ToLower(tsc.CompilerOptions.Target) {
		case "esnest":
			target = api.ESNext
		case "es5":
			target = api.ES5
		case "es2015":
			target = api.ES2015
		case "es2016":
			target = api.ES2016
		case "es2017":
			target = api.ES2017
		case "es2018":
			target = api.ES2018
		case "es2019":
			target = api.ES2019
		case "es2020":
			target = api.ES2020
		case "es2021":
			target = api.ES2021
		}
	})

	return target, targetErr
}

func (fw *TemplatedBasedFileWriter) createDirIfNeeded() bool {
	return fw.CreateDirIfNeeded
}

func (fw *TemplatedBasedFileWriter) getPathToFile() string {
	return fw.PathToFile
}

func (fw *TemplatedBasedFileWriter) generateBytes(opt *Options, si *statInfo) ([]byte, error) {
	// execute template
	buf, err := fw.executeTemplate()
	if err != nil {
		return nil, err
	}

	// formatting typescript
	// vs formatting go!
	if strings.HasSuffix(fw.getPathToFile(), ".go") {
		return fw.formatGo(buf)
	} else if strings.HasSuffix(fw.getPathToFile(), ".ts") {
		return fw.handleTSFile(opt, si, buf)
	}
	return buf.Bytes(), nil
}

func (fw *TemplatedBasedFileWriter) formatGo(buf *bytes.Buffer) ([]byte, error) {
	var b []byte
	var err error
	if fw.Imports != nil {
		buf, err = fw.handleManualGoImports(buf)
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
		fmt.Println(buf.String())
	}

	return b, err
}

func (fw *TemplatedBasedFileWriter) handleTSFile(opt *Options, si *statInfo, buf *bytes.Buffer) ([]byte, error) {
	if fw.TsImports != nil {
		var err error
		buf, err = fw.handleManualTsImports(buf)
		if err != nil {
			return nil, err
		}
	}

	// file doesn't exist, nothing to check
	if si.fileInfo == nil || os.IsNotExist(si.err) {
		return buf.Bytes(), nil
	}

	fileContents, err := os.ReadFile(fw.PathToFile)
	if err != nil {
		return buf.Bytes(), nil
	}
	target, err := findApiTarget(fw.PathToFile)
	if err != nil {
		target = api.DefaultTarget
		debugLogInfo(opt, "error getting tsconfig.json target: %v", err)
	}
	// new code
	result := api.Transform(buf.String(), api.TransformOptions{
		Target:           target,
		Loader:           api.LoaderTS,
		MinifyWhitespace: true,
		MinifySyntax:     true,
	})

	existingResult := api.Transform(string(fileContents), api.TransformOptions{
		Target:           target,
		Loader:           api.LoaderTS,
		MinifyWhitespace: true,
		MinifySyntax:     true,
	})

	// there's an error, nothing to do here. bye
	if len(result.Errors) != 0 || len(existingResult.Errors) != 0 {
		return buf.Bytes(), nil
	}

	if len(result.Warnings) != 0 {
		debugLogInfo(opt, "%s new file contents: %d warnings\n",
			fw.PathToFile,
			len(result.Warnings))
	}

	if len(existingResult.Warnings) != 0 {
		debugLogInfo(opt, "%s existing file: %d warnings\n",
			fw.PathToFile,
			len(existingResult.Warnings))
	}

	if bytes.Equal(result.Code, existingResult.Code) {
		// nothing changed, no bytes to write
		return nil, nil
	}

	return buf.Bytes(), nil
}

func (fw *TemplatedBasedFileWriter) executeTemplate() (*bytes.Buffer, error) {
	paths := []string{fw.AbsPathToTemplate}
	if len(fw.OtherTemplateFiles) != 0 {
		paths = append(paths, fw.OtherTemplateFiles...)
	}
	t := template.New(fw.TemplateName)
	if fw.FuncMap != nil {
		t = t.Funcs(fw.FuncMap)
	}
	t, err := t.ParseFiles(paths...)
	if err != nil {
		return nil, err
	}

	var buffer bytes.Buffer

	// execute the template and store in buffer
	//	err = t.Execute(&buffer, fw.Data)
	err = t.ExecuteTemplate(&buffer, fw.TemplateName, fw.Data)
	return &buffer, err
}

func writeBuffer(result *bytes.Buffer, strs ...string) error {
	for _, str := range strs {
		_, err := result.WriteString(str)
		if err != nil {
			return err
		}
	}
	return nil
}

func (fw *TemplatedBasedFileWriter) handleManualGoImports(buf *bytes.Buffer) (*bytes.Buffer, error) {
	var result bytes.Buffer
	if fw.EditableCode {
		if err := writeBuffer(&result, "// Code generated by github.com/lolopinto/ent/ent. \n\n"); err != nil {
			return nil, err
		}
	} else {
		if err := writeBuffer(&result, "// Code generated by github.com/lolopinto/ent/ent, DO NOT EDIT.\n\n"); err != nil {
			return nil, err
		}
	}

	err := writeBuffer(
		&result,
		"package ",
		fw.PackageName,
		"\n\n",
		"import (\n",
		fw.Imports.String(),
		")\n",
	)
	if err != nil {
		return nil, err
	}
	_, err = buf.WriteTo(&result)

	return &result, err
}

func (fw *TemplatedBasedFileWriter) handleManualTsImports(buf *bytes.Buffer) (*bytes.Buffer, error) {
	var result bytes.Buffer

	var generatedHeader string
	if fw.Config != nil {
		generatedHeader = fw.Config.GeneratedHeader()
	}
	generatedSig := "Generated by github.com/lolopinto/ent/ent, DO NOT EDIT."
	addGeneratedSig := !fw.EditableCode

	// there's 3 modes
	// generatedHeader + generated sig (always autogenerated code)
	// generated sig only (no generated header - when there's nothing configured)
	// generated header in comments only (generated header in editable files)
	if generatedHeader != "" {
		lines := []string{
			"/**\n",
			// Copyright blah blah blah line
			" * " + generatedHeader + "\n",
		}
		if addGeneratedSig {
			// generated by git... line
			lines = append(lines, " * "+generatedSig+"\n")
		}
		lines = append(lines, " */\n\n")

		/**
		 * Copyright blah blah blah
		 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
		 */
		if err := writeBuffer(&result, lines...); err != nil {
			return nil, err
		}
	} else if addGeneratedSig {
		if err := writeBuffer(&result, "// ", generatedSig, "\n\n"); err != nil {
			return nil, err
		}
	}
	str, err := fw.TsImports.String()
	if err != nil {
		return nil, err
	}
	_, err = result.WriteString(str)
	if err != nil {
		return nil, err
	}
	_, err = buf.WriteTo(&result)

	return &result, err
}

func (fw *TemplatedBasedFileWriter) Write(opts ...func(opt *Options)) error {
	return writeFile(fw, fw.Config, opts...)
}
