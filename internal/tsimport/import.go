package tsimport

import (
	"fmt"
	"strconv"
	"strings"
	"text/template"
)

// Imports keeps track of imports in a generated typescript file
type Imports struct {
	exportMap   map[string]*importInfo
	pathMap     map[string]*importInfo
	usedExports map[string]bool
	imports     []*importInfo
	exports     []*exportInfo
}

// NewImports is the constructor for Imports
func NewImports() *Imports {
	return &Imports{
		exportMap:   make(map[string]*importInfo),
		usedExports: make(map[string]bool),
		pathMap:     make(map[string]*importInfo),
	}
}

// Reserve reserves a path and list of exports
func (imps *Imports) Reserve(path string, exports ...string) (string, error) {
	return imps.reserve(path, "", false, exports)
}

// ReserveDefault reserves the default export from a path and a list of exports
func (imps *Imports) ReserveDefault(path, defaultExport string, exports ...string) (string, error) {
	return imps.reserve(path, defaultExport, false, exports)
}

// ReserveAll reserves importing all from a path as the alias
func (imps *Imports) ReserveAll(path, as string) (string, error) {
	return imps.reserve(path, "", true, []string{as})
}

func (imps *Imports) reserve(path string, defaultExport string, importAll bool, exports []string) (string, error) {
	var imp *importInfo
	imp = imps.pathMap[path]

	if defaultExport != "" {
		exports = append(exports, defaultExport)
	}

	// not there, create a new one...
	if imp == nil {
		imp = &importInfo{
			path:          path,
			exports:       exports,
			importAll:     importAll,
			defaultExport: defaultExport,
		}

		imps.pathMap[path] = imp
		imps.imports = append(imps.imports, imp)

	} else {
		// update existing one...
		if defaultExport != "" && imp.defaultExport != defaultExport && imp.defaultExport != "" {
			return "", fmt.Errorf("can't set %s as new default export for %s. %s already default export", defaultExport, path, imp.defaultExport)
		}
		if defaultExport != "" {
			imp.defaultExport = defaultExport
		}
		imp.exports = append(imp.exports, exports...)
		if importAll {
			imp.importAll = true
		}
	}

	for _, export := range exports {
		existingImport := imps.exportMap[export]
		if existingImport != nil && existingImport != imp {
			return "", fmt.Errorf("%s is already exported from path %s. duplicate path: %s", export, existingImport.path, imp.path)
		}
		imps.exportMap[export] = imp
	}
	return "", nil
}

func (imps *Imports) ExportAll(path string) (string, error) {
	return imps.export(path, "")
}

func (imps *Imports) ExportAllAs(path, as string) (string, error) {
	return imps.export(path, as)
}

func (imps *Imports) Export(path string, exports ...string) (string, error) {
	return imps.export(path, "", exports...)
}

func (imps *Imports) export(path string, as string, exports ...string) (string, error) {
	// for now just keep it simple and don't deal with duplicate paths
	imps.exports = append(imps.exports, &exportInfo{
		path:    path,
		as:      as,
		exports: exports,
	})
	return "", nil
}

// FuncMap returns the FuncMap to be passed to a template
func (imps *Imports) FuncMap() template.FuncMap {
	return template.FuncMap{
		"reserveImport":        imps.Reserve,
		"reserveDefaultImport": imps.ReserveDefault,
		"reserveAllImport":     imps.ReserveAll,
		"useImport":            imps.Use,
		"exportAll":            imps.ExportAll,
		"exportAllAs":          imps.ExportAllAs,
		"export":               imps.Export,
	}
}

// Use makes use of an export and ensures that's imported
func (imps *Imports) Use(export string) (string, error) {
	if imps.exportMap[export] == nil {
		return "", fmt.Errorf("tried to use export %s even though it was never reserved", export)
	}

	imps.usedExports[export] = true
	return export, nil
}

// Returns a list of imported lines
func (imps *Imports) String() (string, error) {
	var sb strings.Builder

	for _, exp := range imps.exports {
		str := exp.String()
		if str == "" {
			continue
		}
		_, err := sb.WriteString(str)
		if err != nil {
			return "", err
		}
		sb.WriteString("\n")
	}
	for _, imp := range imps.imports {

		str, err := imp.String(imps.usedExports)

		if err != nil {
			return "", err
		}
		if str == "" {
			continue
		}
		_, err = sb.WriteString(str)
		if err != nil {
			return "", err
		}
		sb.WriteString("\n")
	}

	return sb.String(), nil
}

type importInfo struct {
	path          string
	exports       []string
	defaultExport string
	importAll     bool
}

func (imp *importInfo) String(usedExportsMap map[string]bool) (string, error) {
	var usedExports []string
	var defaultExport string
	seen := make(map[string]bool)
	for _, export := range imp.exports {
		if !usedExportsMap[export] {
			continue
		}
		if seen[export] {
			continue
		}

		// to keep track of duplicates
		seen[export] = true

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

type exportInfo struct {
	path    string
	as      string   // as "" means exportAll
	exports []string // empty means ecportAll
}

func (exp *exportInfo) String() string {
	if exp.as == "" && len(exp.exports) == 0 {
		return fmt.Sprintf("export * from %s;", strconv.Quote(exp.path))
	}
	if exp.as != "" {
		return fmt.Sprintf("export * as %s from %s;", exp.as, strconv.Quote(exp.path))
	}

	return fmt.Sprintf(
		"export {%s} from %s;",
		strings.Join(exp.exports, ", "),
		strconv.Quote(exp.path),
	)
}
