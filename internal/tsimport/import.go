package tsimport

import (
	"fmt"
	"sort"
	"strconv"
	"strings"
	"text/template"

	"github.com/iancoleman/strcase"
	"github.com/lolopinto/ent/internal/codepath"
)

// Imports keeps track of imports in a generated typescript file
type Imports struct {
	exportMap   map[string]*importInfo
	pathMap     map[string]*importInfo
	usedExports map[string]bool
	imports     []*importInfo
	exports     []*exportInfo
	filePath    string
	cfg         Config
}

type Config interface {
	GetAbsPathToRoot() string
	ShouldUseRelativePaths() bool
}

// NewImports is the constructor for Imports
// filePath is path that's currently being written
func NewImports(cfg Config, filePath string) *Imports {
	return &Imports{
		exportMap:   make(map[string]*importInfo),
		usedExports: make(map[string]bool),
		pathMap:     make(map[string]*importInfo),
		filePath:    filePath,
		cfg:         cfg,
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
		"useImportMaybe":       imps.UseMaybe,
		"exportAll":            imps.ExportAll,
		"exportAllAs":          imps.ExportAllAs,
		"export":               imps.Export,
		"dict":                 dict,
		"toCamel":              strcase.ToCamel,
	}
}

func dict(values ...interface{}) (map[string]interface{}, error) {
	if len(values)%2 != 0 {
		return nil, fmt.Errorf("odd number of elements passed to dict")
	}
	ret := make(map[string]interface{}, len(values)/2)

	for i := 0; i < len(values); i += 2 {
		key, ok := values[i].(string)
		if !ok {
			return nil, fmt.Errorf("dict keys must be strings")
		}
		ret[key] = values[i+1]
	}
	return ret, nil
}

// Use makes use of an export and ensures that's imported
func (imps *Imports) Use(export string) (string, error) {
	if imps.exportMap[export] == nil {
		return "", fmt.Errorf("tried to use export %s even though it was never reserved", export)
	}

	imps.usedExports[export] = true
	return export, nil
}

func (imps *Imports) UseMaybe(export string) (string, error) {
	// nothing to do here
	// for scenarios where there's a local import
	if imps.exportMap[export] == nil {
		return export, nil
	}

	imps.usedExports[export] = true
	return export, nil
}

func getSortBucket(path string) int {
	if strings.HasPrefix(path, "src") {
		return 100
	} else if strings.HasPrefix(path, codepath.Package) {
		return 10
	} else if strings.HasPrefix(path, "./") || strings.HasPrefix(path, "..") {
		return 1000
	} else {
		// absolute path like "graphql"
		return 0
	}
}

func cmp(path1, path2 string) bool {
	order1 := getSortBucket(path1)
	order2 := getSortBucket(path2)

	if order1 == order2 {
		// if equal, sort within the bucket
		// currently, this depends on src/ent < src/graphql
		return path1 < path2

	} else if order1 < order2 {
		return true
	}
	return false
}

// Returns a list of imported lines
func (imps *Imports) String() (string, error) {
	var sb strings.Builder

	for _, exp := range imps.exports {
		str, err := exp.String(imps.cfg, imps.filePath)
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
		_, err = sb.WriteString("\n")
		if err != nil {
			return "", err
		}
	}

	sort.Slice(imps.imports, func(i, j int) bool {
		return cmp(imps.imports[i].path, imps.imports[j].path)
	})

	for _, imp := range imps.imports {

		str, err := imp.String(imps.cfg, imps.filePath, imps.usedExports)

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

func (imp *importInfo) String(cfg Config, filePath string, usedExportsMap map[string]bool) (string, error) {
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
			sort.Strings(usedExports)
			imports = append(imports, fmt.Sprintf("{%s}", strings.Join(usedExports, ", ")))
		}
	}
	sort.Strings(imports)

	impPath, err := getImportPath(cfg, filePath, imp.path)
	if err != nil {
		return "", err
	}

	return fmt.Sprintf(
		"import %s from %s;",
		strings.Join(imports, ", "), strconv.Quote(impPath),
	), nil
}

type exportInfo struct {
	path    string
	as      string   // as "" means exportAll
	exports []string // empty means ecportAll
}

func (exp *exportInfo) String(cfg Config, filePath string) (string, error) {
	impPath, err := getImportPath(cfg, filePath, exp.path)
	if err != nil {
		return "", err
	}
	if exp.as == "" && len(exp.exports) == 0 {
		return fmt.Sprintf("export * from %s;", strconv.Quote(impPath)), nil
	}
	if exp.as != "" {
		return fmt.Sprintf("export * as %s from %s;", exp.as, strconv.Quote(impPath)), nil
	}
	sort.Strings(exp.exports)
	return fmt.Sprintf(
		"export {%s} from %s;",
		strings.Join(exp.exports, ", "),
		strconv.Quote(impPath),
	), nil
}
