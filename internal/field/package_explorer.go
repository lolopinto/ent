package field

import (
	"fmt"
	"go/ast"
	"go/types"
	"path/filepath"
	"sync"

	"github.com/davecgh/go-spew/spew"
	"github.com/lolopinto/ent/internal/astparser"
	"golang.org/x/tools/go/packages"
)

type typeResult struct {
	entType types.Type
	err     error
}

type packageExplorer struct {
	m sync.Mutex

	// having a map from function type to result could speed things up a bit
	// caches results from getEntFromPkg instead of re-running that multiple times
	//	functionMap map[string]*typeResult?

	pkgMap map[string]*packageType
}

// public API
func (explorer *packageExplorer) getTypeForInfo(
	pkg *packages.Package,
	info *argInfo,

) chan typeResult {
	chanRes := make(chan typeResult)
	go func() {
		spew.Dump(info)
		importedPkg := getImportedPackageThatMatchesIdent(pkg, info.pkgName, info.identName)
		chanPkg := explorer.explorePackage(importedPkg)

		parsedPkg := <-chanPkg

		typ, err := explorer.getEntFromPkg(parsedPkg, info)
		chanRes <- typeResult{
			err:     err,
			entType: typ,
		}
	}()

	return chanRes
}

func (explorer *packageExplorer) explorePackage(
	pkg *packages.Package,
) chan *packageType {
	chanRes := make(chan *packageType)

	go func() {
		parsedPkg, ok := explorer.pkgMap[pkg.PkgPath]

		// fully loaded return immediately. nothing to do here.
		if ok && parsedPkg.fullyLoaded() {
			chanRes <- parsedPkg
			return
		}

		// first time seeing this package.
		// create a new one, mark it as seen and schedule it to run
		// separating mark and schedule so that we block for as little time as possible
		if !ok {
			parsedPkg = newPackageType(pkg)

			explorer.markPackage(parsedPkg)
			go explorer.schedulePackage(parsedPkg, pkg)
		}

		// block until we get a response back
		<-parsedPkg.getChanToWait()
		chanRes <- parsedPkg
	}()
	return chanRes
}

// mark this package as seen
func (explorer *packageExplorer) markPackage(parsedPkg *packageType) {
	explorer.m.Lock()
	defer explorer.m.Unlock()
	explorer.pkgMap[parsedPkg.pkg.PkgPath] = parsedPkg
}

// do all the work to gather data for package
func (explorer *packageExplorer) schedulePackage(
	parsedPkg *packageType,
	pkg *packages.Package,
) {

	// everything from here *should* be safe. we're changing an object that shouldn't be touched
	// by other goroutines
	explorer.gatherStructs(parsedPkg, pkg)
	explorer.annotateFuncs(parsedPkg, pkg)

	// this should always be the last line here since it sends control back to listening channels
	parsedPkg.flagDone()
}

func (explorer *packageExplorer) gatherStructs(
	parsedPkg *packageType,
	pkg *packages.Package,
) {
	// gather the structs (we care about)
	for k, v := range pkg.TypesInfo.Defs {
		_, ok := v.(*types.TypeName)
		if !ok {
			continue
		}
		// TODO we can eliminate those that don't implement the interface
		// come back
		t, ok := k.Obj.Decl.(*ast.TypeSpec)
		if !ok {
			panic("invalid typespec")
		}

		s, ok := t.Type.(*ast.StructType)
		if !ok {
			continue
		}

		parsedPkg.addStruct(explorer.buildStruct(pkg, t, s))
	}
}

func (explorer *packageExplorer) annotateFuncs(
	parsedPkg *packageType,
	pkg *packages.Package,
) {
	// add information from functions about gathered structs
	for _, file := range pkg.Syntax {
		for _, decl := range file.Decls {
			if fn, ok := decl.(*ast.FuncDecl); ok {

				// top level functions field.Int -> IntegerType
				if fn.Recv == nil {

					results := fn.Type.Results

					// TOOD? this doesn't work for methods of a type
					// right now it's assuming part of a package
					// not worth fixing right now since this should be a super edge case
					if len(results.List) == 1 {
						result := astparser.GetFieldTypeInfo(results.List[0])
						if result.PackageName != "" {
							panic("do not currently support functions that return Types in a different package")
						}

						// only do this if this is one of the types we care about
						if parsedPkg.structMap[result.Name] != nil {
							parsedPkg.addFuncToMap(fn.Name.Name, result.Name)
						}
					}
					continue
				}

				// Find Type, PackagePath etc methods
				recv := astparser.GetFieldTypeInfo(fn.Recv.List[0])

				s, ok := parsedPkg.structMap[recv.Name]
				// this isn't one of the methods we care about
				if !ok {
					continue
				}

				customizeFn, ok := dataTypeMethods[fn.Name.Name]
				if !ok {
					continue
				}
				customizeFn(pkg, s, fn)
			}
		}
	}
}

func (explorer *packageExplorer) buildStruct(
	pkg *packages.Package,
	t *ast.TypeSpec,
	s *ast.StructType,
) *structType {
	ret := &structType{name: t.Name.Name}

	for _, f := range s.Fields.List {
		if len(f.Names) != 0 {
			continue
		}
		// todo we need to get the imports and get full path etc
		fieldTypeInfo := astparser.GetFieldTypeInfo(f)

		var depPkg *packages.Package
		// current package
		if fieldTypeInfo.PackageName == "" {
			depPkg = pkg
		} else {
			depPkg = getImportedPackageThatMatchesIdent(
				pkg,
				fieldTypeInfo.PackageName,
				fieldTypeInfo.Name,
			)

			// found a new package. need to explore that also...
			// wait till it's done
			newPkg := explorer.explorePackage(depPkg)
			<-newPkg
		}

		ret.addDepdendency(depPkg, fieldTypeInfo.Name)
	}

	return ret
}

// this gets a parsed Package, function and figures out the entType
func (explorer *packageExplorer) getEntFromPkg(
	parsedPkg *packageType,
	info *argInfo,
) (types.Type, error) {
	var structName string

	switch info.fmt {
	case typFormat:
		// type, get the structName from the identifier
		structName = info.identName
		break

	case functionFormat:
		// func get the structName from the map
		structName = parsedPkg.funcMap[info.identName]
		if structName == "" {
			return nil, fmt.Errorf("couldn't find type in package for function %s.%s", info.pkgName, info.identName)
		}
		break
	}

	s := parsedPkg.structMap[structName]
	if s == nil {
		return nil, fmt.Errorf("couldn't find struct %s in package for type %s.%s", structName, info.pkgName, info.identName)
	}

	return explorer.getEntType(s)
}

// helper function for getEntFromPkg. called recursively
func (explorer *packageExplorer) getEntType(s *structType) (types.Type, error) {
	if s.typeFromMethod != nil {
		return s.typeFromMethod, nil
	}

	for _, dep := range s.dependencies {
		pkgPath, structName := dep.pkgPath, dep.ident
		pkg := explorer.pkgMap[pkgPath]
		if pkg == nil {
			// TODO would be nice to have package this struct belongs in here
			return nil, fmt.Errorf("couldn't find package %s even though it's a dependency for %s", pkgPath, s.name)
		}

		depStruct := pkg.structMap[structName]
		if depStruct == nil {
			// TODO would be nice to have package this stuct belongs in here
			return nil, fmt.Errorf("couldn't find struct %s in package %s", structName, pkgPath)
		}

		// call this function recursively for this dependency
		// return value if we found typ or err
		typ, err := explorer.getEntType(depStruct)
		if err != nil || typ != nil {
			return typ, err
		}
	}
	// another place where pkgName would be useful
	return nil, fmt.Errorf("couldn't figure out typ for %s", s.name)
}

func newPackageType(pkg *packages.Package) *packageType {
	ret := &packageType{pkg: pkg}
	ret.structMap = make(map[string]*structType)
	ret.funcMap = make(map[string]string)
	return ret
}

type packageType struct {
	pkg       *packages.Package
	structMap map[string]*structType
	funcMap   map[string]string

	rw sync.RWMutex
	// keep track of channels we need to broadcast information when multiple
	// goroutines are depending on this package
	chans []chan bool

	// once we're done loading, we use this flag to avoid communicating via channels
	// and end quickly
	// hmm, is there a small chance of race conditions in explorePackage()??
	loadedFlag bool
}

func (t *packageType) fullyLoaded() bool {
	t.rw.RLock()
	defer t.rw.RUnlock()
	return t.loadedFlag
}

func (t *packageType) flagDone() {
	t.rw.Lock()
	defer t.rw.Unlock()
	t.loadedFlag = true
	// broadcast done to all channels waiting for this
	for _, c := range t.chans {
		c <- true
	}
}

// get new channel to wait on this package to be done loading
func (t *packageType) getChanToWait() chan bool {
	t.rw.Lock()
	defer t.rw.Unlock()
	done := make(chan bool)
	t.chans = append(t.chans, done)
	return done
}

// add a struct in this package
func (t *packageType) addStruct(s *structType) {
	t.structMap[s.name] = s
}

// add a mapping from function name to struct return type
// e.g. so that we know that field.Int -> returns IntegerType
func (t *packageType) addFuncToMap(funcName, structName string) {
	t.funcMap[funcName] = structName
}

// pkgPath + ident which are dependencies of a struct
// e.g.  for url.FieldType
// it'll contain one instance of this with pkgPath "github.com/lolopinto/ent/ent/field and ident StringType
type structDep struct {
	pkgPath string
	ident   string
}

// each relevant struct we find
type structType struct {
	name string

	// other structs/interfaces in field list
	dependencies   []*structDep
	typeFromMethod types.Type
	packagePath    string
}

func (s *structType) addDepdendency(pkg *packages.Package, ident string) {
	s.dependencies = append(s.dependencies, &structDep{
		pkgPath: pkg.PkgPath,
		ident:   ident,
	})
}

func newPackageExplorer() *packageExplorer {
	ret := packageExplorer{}
	ret.pkgMap = make(map[string]*packageType)
	return &ret
}

// methods we care about in Structs to gather information
var dataTypeMethods = map[string]func(*packages.Package, *structType, *ast.FuncDecl){
	"Type": func(pkg *packages.Package, s *structType, fn *ast.FuncDecl) {
		retStmt := astparser.GetLastReturnStmtExpr(fn)
		s.typeFromMethod = pkg.TypesInfo.TypeOf(retStmt)
	},
	"PackagePath": func(_ *packages.Package, s *structType, fn *ast.FuncDecl) {
		s.packagePath = astparser.GetUnderylingStringFromLiteralExpr(
			astparser.GetLastReturnStmtExpr(fn),
		)
	},
}

// helper function. need to eventually change this to be aware of aliases
func getImportedPackageThatMatchesIdent(
	pkg *packages.Package,
	pkgBase, fnName string,
) *packages.Package {

	// current package
	if pkgBase == "" {
		return pkg
	}

	for path, importedPkg := range pkg.Imports {
		base := filepath.Base(path)

		if base == pkgBase {
			return importedPkg
		}
	}
	panic("couldn't find the right package for function. shouldn't get here")
}
