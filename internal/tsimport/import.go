package tsimport

import (
	"fmt"
	"strconv"
	"strings"
)

type Import struct {
	path          string
	exports       []string
	defaultExport string
	importAll     bool
}

func (imp *Import) String(usedExportsMap map[string]bool) (string, error) {
	var usedExports []string
	var defaultExport string
	for _, export := range imp.exports {
		if !usedExportsMap[export] {
			continue
		}

		if imp.defaultExport == export && imp.defaultExport != "" {
			// default export
			defaultExport = imp.defaultExport
		} else {
			// no default export nothing to do here
			usedExports = append(usedExports, export)
		}
	}

	// not using anything here, we're done with this one
	if len(usedExports) == 0 && defaultExport == "" {
		return "", nil
	}

	var imports []string

	if imp.importAll {
		if defaultExport != "" || len(usedExports) != 1 {
			return "", fmt.Errorf("when importing all, expect 1 export. something broken for %s", imp.path)
		}

		imports = append(imports, fmt.Sprintf("* as %s", usedExports[0]))

	} else {

		if defaultExport != "" {
			imports = append(imports, defaultExport)
		}
		if len(usedExports) != 0 {
			imports = append(imports, fmt.Sprintf("{%s}", strings.Join(usedExports, ", ")))
		}
	}

	return fmt.Sprintf(
		"import %s from %s;",
		strings.Join(imports, ", "), strconv.Quote(imp.path),
	), nil
}

type Imports struct {
	exportMap   map[string]*Import
	usedExports map[string]bool
	imports     []*Import
}

func NewImports() *Imports {
	return &Imports{
		exportMap:   make(map[string]*Import),
		usedExports: make(map[string]bool),
	}
}

func (t *Imports) Reserve(path string, exports ...string) {
	t.reserve(path, "", false, exports)
}

func (t *Imports) ReserveDefault(path string, defaultExport string, exports ...string) {
	t.reserve(path, defaultExport, false, exports)
}

func (t *Imports) ReserveAll(path string, as string) {
	t.reserve(path, "", true, []string{as})
}

func (t *Imports) reserve(path string, defaultExport string, importAll bool, exports []string) {
	imp := &Import{
		path:          path,
		exports:       exports,
		importAll:     importAll,
		defaultExport: defaultExport,
	}

	if defaultExport != "" {
		exports = append(exports, defaultExport)
		imp.exports = exports
	}

	for _, export := range exports {
		existingImport := t.exportMap[export]
		if existingImport != nil {
			panic(fmt.Errorf("%s is already exported from path %s", export, existingImport.path))
		}
		t.exportMap[export] = imp
	}
	t.imports = append(t.imports, imp)
}

// need to use panic/recover here actually because of how it's going to be called
// useExport
func (t *Imports) Use(export string) string {
	if t.exportMap[export] == nil {
		panic(fmt.Sprintf("tried to use export %s even though it was never reserved", export))
	}

	t.usedExports[export] = true
	return export
}

func (t *Imports) String() string {
	var sb strings.Builder
	for _, imp := range t.imports {

		str, err := imp.String(t.usedExports)

		if err != nil {
			panic(err)
		}
		if str == "" {
			continue
		}
		_, err = sb.WriteString(str)
		if err != nil {
			panic(err)
		}
		sb.WriteString("\n")
	}

	return sb.String()
}
