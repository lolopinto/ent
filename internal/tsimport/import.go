package tsimport

import (
	"fmt"
	"path"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"text/template"

	"github.com/lolopinto/ent/internal/codepath"
)

// Imports keeps track of imports in a generated typescript file
type Imports struct {
	importMap       map[string]*importInfo
	pathMap         map[string]*importInfo
	usedImports     map[string]bool
	imports         []*importInfo
	typeImportMap   map[string]*importInfo
	typePathMap     map[string]*importInfo
	usedTypeImports map[string]bool
	typeImports     []*importInfo
	exports         []*exportInfo
	filePath        string
	errorPath       string
	cfg             Config
}

type Config interface {
	GetAbsPathToRoot() string
	ShouldUseRelativePaths() bool
	DebugMode() bool
}

// NewImports is the constructor for Imports
// filePath is path that's currently being written
func NewImports(cfg Config, filePath string) *Imports {
	return &Imports{
		importMap:       make(map[string]*importInfo),
		usedImports:     make(map[string]bool),
		pathMap:         make(map[string]*importInfo),
		typeImportMap:   make(map[string]*importInfo),
		usedTypeImports: make(map[string]bool),
		typePathMap:     make(map[string]*importInfo),
		filePath:        filePath,
		errorPath:       getErrorPath(cfg, filePath),
		cfg:             cfg,
	}
}

// Reserve reserves a path and list of imports
func (imps *Imports) Reserve(path string, imports ...string) (string, error) {
	return imps.reserve(&importInfoInput{
		path:    path,
		imports: imports,
	})
}

// ReserveType reserves a type-only import from a path.
func (imps *Imports) ReserveType(path string, imports ...string) (string, error) {
	return imps.reserve(&importInfoInput{
		path:     path,
		imports:  imports,
		typeOnly: true,
	})
}

// ReserveDefault reserves the default export from a path and a list of exports
func (imps *Imports) ReserveDefault(path, defaultImport string, imports ...string) (string, error) {
	return imps.reserve(&importInfoInput{
		path:          path,
		defaultImport: defaultImport,
		imports:       imports,
	})
}

// ReserveAll reserves importing all from a path as the alias
func (imps *Imports) ReserveAll(path, as string) (string, error) {
	return imps.reserve(&importInfoInput{
		path:          path,
		defaultImport: "",
		importAll:     true,
		imports:       []string{as},
	})
}

// ReserveImportPath takes an instance of importPath and reserves importing from it
// should be default eventually
func (imps *Imports) ReserveImportPath(imp *ImportPath, external bool) (string, error) {
	input := imps.getImportInfoInput(imp, external)
	input.typeOnly = imp.TypeOnly
	return imps.reserve(input)
}

// ReserveTypeImportPath takes an instance of importPath and reserves importing it as type-only.
func (imps *Imports) ReserveTypeImportPath(imp *ImportPath, external bool) (string, error) {
	input := imps.getImportInfoInput(imp, external)
	input.typeOnly = true
	return imps.reserve(input)
}

func (imps *Imports) getImportInfoInput(imp *ImportPath, external bool) *importInfoInput {
	var defaultExport string
	var imports []string

	// we keep the complexity hidden in here so that callsites can just call useImport .Import
	impStr := imp.Import
	var alias string
	if imp.OriginalImport != "" {
		alias = impStr
		impStr = imp.OriginalImport
	}
	if imp.DefaultImport {
		defaultExport = impStr
	} else {
		imports = append(imports, impStr)
	}
	importPath := imp.ImportPath
	if external && imp.TransformedForExternalEnt {
		importPath = codepath.GetExternalImportPath()
	}
	return &importInfoInput{
		path:          importPath,
		defaultImport: defaultExport,
		alias:         alias,
		imports:       imports,
		sideEffect:    imp.SideEffect,
	}
}

// ConditionallyReserveImportPath skips importing when the import path is same as file path
func (imps *Imports) ConditionallyReserveImportPath(imp *ImportPath, external bool) (string, error) {
	input := imps.getImportInfoInput(imp, external)
	input.typeOnly = imp.TypeOnly

	relPath := imps.filePath
	if path.IsAbs(relPath) {
		var err error
		relPath, err = filepath.Rel(imps.cfg.GetAbsPathToRoot(), imps.filePath)
		if err != nil {
			return "", err
		}
	}
	relPath = strings.TrimSuffix(relPath, ".ts")

	// if importing file from same file, ignore
	if relPath == input.path {
		return "", nil
	}

	return imps.reserve(input)
}

type importInfoInput struct {
	path          string
	defaultImport string
	importAll     bool
	imports       []string
	// only works when there's 1 import
	alias      string
	sideEffect bool
	typeOnly   bool
}

func (imps *Imports) reserve(input *importInfoInput) (string, error) {
	if input.alias != "" && len(input.imports) > 1 {
		return "", fmt.Errorf("cannot have an alias with multiple imports")
	}

	if input.alias != "" && input.defaultImport != "" {
		return "", fmt.Errorf("cannot have an alias and default import at the sme time")
	}

	if input.typeOnly && input.sideEffect {
		return "", fmt.Errorf("cannot have a type-only side-effect import for %s", input.path)
	}

	importMap := imps.importMap
	pathMap := imps.pathMap
	importsList := &imps.imports
	otherImportMap := imps.typeImportMap
	if input.typeOnly {
		importMap = imps.typeImportMap
		pathMap = imps.typePathMap
		importsList = &imps.typeImports
		otherImportMap = imps.importMap
	}

	filteredImports := make([]string, 0, len(input.imports))
	for _, v := range input.imports {
		ident := v
		if input.alias != "" {
			ident = input.alias
		}
		if other := otherImportMap[ident]; other != nil && other.path != input.path {
			return "", fmt.Errorf("%s is already imported as a different import type from path %s @ file %s", ident, other.path, getErrorPath(imps.cfg, imps.filePath))
		}
		if otherImportMap[ident] != nil && otherImportMap[ident].path == input.path && input.typeOnly {
			continue
		}
		filteredImports = append(filteredImports, v)
	}
	input.imports = filteredImports
	if input.defaultImport != "" {
		ident := input.defaultImport
		if other := otherImportMap[ident]; other != nil && other.path != input.path {
			return "", fmt.Errorf("%s is already imported as a different import type from path %s @ file %s", ident, other.path, getErrorPath(imps.cfg, imps.filePath))
		}
		if otherImportMap[ident] != nil && otherImportMap[ident].path == input.path && input.typeOnly {
			input.defaultImport = ""
		}
	}

	if len(input.imports) == 0 && input.defaultImport == "" && !input.importAll && !input.sideEffect {
		return "", nil
	}

	var imports []importedItem
	for _, v := range input.imports {
		imports = append(imports, importedItem{
			name:  v,
			alias: input.alias,
		})
	}
	if input.defaultImport != "" {
		imports = append(imports, importedItem{
			name: input.defaultImport,
		})
	}

	imp := pathMap[input.path]

	// not there, create a new one...
	if imp == nil {
		imp = &importInfo{
			path:          input.path,
			imports:       imports,
			importAll:     input.importAll,
			defaultExport: input.defaultImport,
			sideEffect:    input.sideEffect,
			typeOnly:      input.typeOnly,
		}

		pathMap[input.path] = imp
		*importsList = append(*importsList, imp)

	} else {
		// update existing one...
		if input.defaultImport != "" && imp.defaultExport != input.defaultImport && imp.defaultExport != "" {
			return "", fmt.Errorf("can't set %s as new default export for %s. %s already default export", input.defaultImport, input.path, imp.defaultExport)
		}
		if input.defaultImport != "" {
			imp.defaultExport = input.defaultImport
		}
		imp.imports = append(imp.imports, imports...)
		if input.importAll {
			imp.importAll = true
		}
	}

	for _, item := range imports {
		ident := item.getIdent()
		existingImport := importMap[ident]
		if existingImport != nil && existingImport != imp {
			return "", fmt.Errorf("%s is already imported from path %s. duplicate path: %s @ file %s", ident, existingImport.path, imp.path, getErrorPath(imps.cfg, imps.filePath))
		}
		if other := otherImportMap[ident]; other != nil && other.path != imp.path {
			return "", fmt.Errorf("%s is already imported as a different import type from path %s @ file %s", ident, other.path, getErrorPath(imps.cfg, imps.filePath))
		}
		importMap[ident] = imp
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

// ExportType exports type-only bindings from a path.
func (imps *Imports) ExportType(path string, exports ...string) (string, error) {
	return imps.exportType(path, "", exports...)
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

func (imps *Imports) exportType(path string, as string, exports ...string) (string, error) {
	if as != "" {
		return "", fmt.Errorf("export type namespace not supported for %s", path)
	}
	imps.exports = append(imps.exports, &exportInfo{
		path:     path,
		as:       as,
		exports:  exports,
		typeOnly: true,
	})
	return "", nil
}

// FuncMap returns the FuncMap to be passed to a template
func (imps *Imports) FuncMap() template.FuncMap {
	return template.FuncMap{
		"reserveImport":                  imps.Reserve,
		"reserveTypeImport":              imps.ReserveType,
		"reserveDefaultImport":           imps.ReserveDefault,
		"reserveAllImport":               imps.ReserveAll,
		"reserveImportPath":              imps.ReserveImportPath,
		"reserveTypeImportPath":          imps.ReserveTypeImportPath,
		"conditionallyReserveImportPath": imps.ConditionallyReserveImportPath,
		"useImport":                      imps.Use,
		"useImportMaybe":                 imps.UseMaybe,
		"useTypeImport":                  imps.UseType,
		"useTypeImportMaybe":             imps.UseTypeMaybe,
		"exportAll":                      imps.ExportAll,
		"exportAllAs":                    imps.ExportAllAs,
		"export":                         imps.Export,
		"exportType":                     imps.ExportType,
		"dict":                           dict,
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
func (imps *Imports) Use(impItem string) (string, error) {
	if imps.importMap[impItem] == nil {
		if imps.cfg.DebugMode() {
			var imports []string
			for k := range imps.importMap {
				imports = append(imports, k)
			}
			sort.Strings(imports)
			fmt.Printf("imports at path %s are %v \n", imps.filePath, imports)
		}
		return "", fmt.Errorf("tried to use import %s at path %s even though it was never reserved", impItem, imps.errorPath)
	}

	imps.usedImports[impItem] = true
	return impItem, nil
}

func (imps *Imports) UseMaybe(export string) (string, error) {
	// nothing to do here
	// for scenarios where there's a local import
	if imps.importMap[export] == nil {
		return export, nil
	}

	imps.usedImports[export] = true
	return export, nil
}

// UseType makes use of a type-only import and ensures it's imported
func (imps *Imports) UseType(impItem string) (string, error) {
	if imps.typeImportMap[impItem] == nil {
		if imps.importMap[impItem] != nil {
			imps.usedImports[impItem] = true
			return impItem, nil
		}
		if imps.cfg.DebugMode() {
			var imports []string
			for k := range imps.typeImportMap {
				imports = append(imports, k)
			}
			sort.Strings(imports)
			fmt.Printf("type imports at path %s are %v \n", imps.filePath, imports)
		}
		return "", fmt.Errorf("tried to use type import %s at path %s even though it was never reserved", impItem, imps.errorPath)
	}

	imps.usedTypeImports[impItem] = true
	return impItem, nil
}

// UseTypeMaybe makes use of a type-only import if it exists.
func (imps *Imports) UseTypeMaybe(export string) (string, error) {
	if imps.typeImportMap[export] == nil {
		if imps.importMap[export] != nil {
			imps.usedImports[export] = true
		}
		return export, nil
	}

	imps.usedTypeImports[export] = true
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

	sort.Slice(imps.typeImports, func(i, j int) bool {
		return cmp(imps.typeImports[i].path, imps.typeImports[j].path)
	})

	for _, imp := range imps.typeImports {
		str, err := imp.String(imps.cfg, imps.filePath, imps.usedTypeImports)
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

	sort.Slice(imps.imports, func(i, j int) bool {
		return cmp(imps.imports[i].path, imps.imports[j].path)
	})

	for _, imp := range imps.imports {
		str, err := imp.String(imps.cfg, imps.filePath, imps.usedImports)
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

type importedItem struct {
	name  string
	alias string
}

func (i importedItem) getIdent() string {
	if i.alias != "" {
		return i.alias
	}
	return i.name
}

func (i importedItem) String() string {
	if i.alias != "" {
		return fmt.Sprintf("%s as %s", i.name, i.alias)
	}
	return i.name
}

type importInfo struct {
	path          string
	imports       []importedItem
	defaultExport string
	importAll     bool
	// import just for side effect
	sideEffect bool
	typeOnly   bool
}

func (imp *importInfo) String(cfg Config, filePath string, usedExportsMap map[string]bool) (string, error) {
	if imp.sideEffect {
		if imp.typeOnly {
			return "", fmt.Errorf("cannot have a type-only side-effect import for %s", imp.path)
		}
		impPath, err := getImportPath(cfg, filePath, imp.path)
		if err != nil {
			return "", err
		}
		return fmt.Sprintf(
			"import %s;",
			strconv.Quote(impPath),
		), nil
	}

	var usedImports []importedItem
	var defaultExport string
	seen := make(map[string]bool)
	for _, item := range imp.imports {
		ident := item.getIdent()
		if !usedExportsMap[ident] {
			continue
		}
		if seen[ident] {
			continue
		}

		// to keep track of duplicates
		seen[ident] = true

		if imp.defaultExport == ident && imp.defaultExport != "" {
			// default export
			defaultExport = imp.defaultExport
		} else {
			// no default export nothing to do here
			usedImports = append(usedImports, item)
		}
	}

	// not using anything here, we're done with this one
	if len(usedImports) == 0 && defaultExport == "" {
		return "", nil
	}

	var imports []string

	if imp.importAll {
		if defaultExport != "" || len(usedImports) != 1 {
			return "", fmt.Errorf("when importing all, expect 1 export. something broken for %s", imp.path)
		}

		imports = append(imports, fmt.Sprintf("* as %s", usedImports[0]))

	} else {
		if defaultExport != "" {
			imports = append(imports, defaultExport)
		}
		if len(usedImports) != 0 {
			sort.Slice(usedImports, func(i, j int) bool {
				idx := strings.Compare(usedImports[i].getIdent(), usedImports[j].getIdent())
				return idx < 0
			})

			imps := make([]string, len(usedImports))
			for i, imp := range usedImports {
				imps[i] = imp.String()
			}
			imports = append(imports, fmt.Sprintf("{%s}", strings.Join(imps, ", ")))
		}
	}
	sort.Strings(imports)

	impPath, err := getImportPath(cfg, filePath, imp.path)
	if err != nil {
		return "", err
	}

	kw := "import"
	if imp.typeOnly {
		kw = "import type"
	}
	return fmt.Sprintf(
		"%s %s from %s;",
		kw, strings.Join(imports, ", "), strconv.Quote(impPath),
	), nil
}

type exportInfo struct {
	path     string
	as       string   // as "" means exportAll
	exports  []string // empty means ecportAll
	typeOnly bool
}

func (exp *exportInfo) String(cfg Config, filePath string) (string, error) {
	impPath, err := getImportPath(cfg, filePath, exp.path)
	if err != nil {
		return "", err
	}
	if exp.typeOnly {
		if exp.as != "" {
			return "", fmt.Errorf("export type namespace not supported for %s", exp.path)
		}
		if len(exp.exports) == 0 {
			return fmt.Sprintf("export type * from %s;", strconv.Quote(impPath)), nil
		}
		sort.Strings(exp.exports)
		return fmt.Sprintf(
			"export type {%s} from %s;",
			strings.Join(exp.exports, ", "),
			strconv.Quote(impPath),
		), nil
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
