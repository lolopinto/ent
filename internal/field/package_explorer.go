package field

import (
	"errors"
	"fmt"
	"go/ast"
	"go/types"
	"path/filepath"

	"sync"

	"github.com/lolopinto/ent/internal/astparser"
	"github.com/lolopinto/ent/internal/util"
	"golang.org/x/tools/go/packages"
)

type parseResult struct {
	entType types.Type
	pkgPath string
	err     error
	private bool
}

type packageExplorer struct {
	m sync.Mutex

	// having a map from function type to result could speed things up a bit
	// caches results from getEntFromPkg instead of re-running that multiple times
	//	functionMap map[string]*parseResult?

	pkgMap map[string]*packageType
}

// public API
func (explorer *packageExplorer) getTypeForInfo(
	pkg *packages.Package,
	info *astparser.Result,
) chan *parseResult {
	chanRes := make(chan *parseResult)
	go func() {
		importedPkg := getImportedPackageThatMatchesIdent(pkg, info.PkgName, info.IdentName)
		chanPkg := explorer.explorePackage(importedPkg)

		parsedPkg := <-chanPkg

		chanRes <- explorer.getResultFromPkg(parsedPkg, info, pkg)
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
			util.GoSchemaKill("invalid typespec")
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
						result, err := astparser.ParseFieldType(results.List[0])
						if err != nil {
							util.GoSchemaKill(err)
						}
						if result.PkgName != "" {
							util.GoSchemaKill("do not currently support functions that return Types in a different package")
						}

						// if this is not one of the functions we care about, bye
						if parsedPkg.structMap[result.IdentName] == nil {
							continue
						}
						parsedPkg.addFuncToStructMap(fn.Name.Name, result.IdentName)

						retStmt := astparser.GetLastReturnStmtExpr(fn)
						retResult, err := astparser.Parse(retStmt)
						if err != nil {
							util.GoSchemaKill(err)
						}
						// TODO validate that it's field.JSONTypeType
						// right now we assume just JSON but will break if something else does this that's not expected
						if retResult.Format != astparser.FunctionFormat ||
							retResult.IdentName != "JSONType" {
							continue
						}

						if typ, _ := explorer.parseFieldJSON(pkg, retResult); typ != nil {
							parsedPkg.addFuncTypeOverride(fn.Name.Name, typ)
						}
					}
					continue
				}

				recv, err := astparser.ParseFieldType(fn.Recv.List[0])
				if err != nil {
					util.GoSchemaKill(err)
				}

				s, ok := parsedPkg.structMap[recv.IdentName]
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
		info, err := astparser.ParseFieldType(f)
		if err != nil {
			util.GoSchemaKill(err)
		}

		var depPkg *packages.Package
		// current package
		if info.PkgName == "" {
			depPkg = pkg
		} else {
			depPkg = getImportedPackageThatMatchesIdent(
				pkg,
				info.PkgName,
				info.IdentName,
			)

			// found a new package. need to explore that also...
			// wait till it's done
			newPkg := explorer.explorePackage(depPkg)
			<-newPkg
		}

		ret.addDepdendency(depPkg, info.IdentName)
	}

	return ret
}

func (explorer *packageExplorer) parseFieldJSON(
	pkg *packages.Package,
	result *astparser.Result, // field.JSONTypeType() line
) (types.Type, string) {
	if len(result.Args) == 0 {
		return nil, ""
	}
	arg := result.Args[0]
	typ := pkg.TypesInfo.TypeOf(arg.Expr)

	// nothing to do here. not importing anything
	if arg.PkgName == "" && arg.IdentName == "" {
		return typ, ""
	}

	importedPkg := getImportedPackageThatMatchesIdent(pkg, arg.PkgName, arg.IdentName)

	return typ, importedPkg.PkgPath
}

// this gets a parsed Package, function and figures out the entType and packagePath
func (explorer *packageExplorer) getResultFromPkg(
	parsedPkg *packageType,
	info *astparser.Result,
	callingPkg *packages.Package,
) *parseResult {
	var structName string

	switch info.Format {
	case astparser.TypFormat:
		// type, get the structName from the identifier
		structName = info.IdentName
		break

	case astparser.FunctionFormat:
		// field.JSONType called directly. handle this case specifically
		// we need to check the expr and get it from there since we need that from runtime information
		if info.IdentName == "JSONType" && info.PkgName == "field" {
			if info.Expr == nil {
				return &parseResult{
					err: errors.New("couldn't get the type info from json field because nil expr"),
				}
			}

			typ, pkgPath := explorer.parseFieldJSON(callingPkg, info)
			if typ == nil {
				return &parseResult{
					err: errors.New("couldn't get type info from json field because we couldn't parse expr"),
				}
			}
			return &parseResult{
				entType: typ,
				pkgPath: pkgPath,
			}
		}

		// this is for things like field.IntsType(), field.Strings etc that call field.JSONType
		typeOverride := parsedPkg.funcTypeOverride[info.IdentName]
		if typeOverride != nil {
			return &parseResult{
				entType: typeOverride,
			}
		}

		// func get the structName from the map
		structName = parsedPkg.funcMap[info.IdentName]
		if structName == "" {
			return &parseResult{
				err: fmt.Errorf("couldn't find type in package for function %s.%s", info.PkgName, info.IdentName),
			}
		}
		break
	}

	s := parsedPkg.structMap[structName]
	if s == nil {
		return &parseResult{
			err: fmt.Errorf("couldn't find struct %s in package for type %s.%s", structName, info.PkgName, info.IdentName),
		}
	}

	return explorer.getResultFromStruct(s)
}

// helper function for getResultFromPkg. called recursively
func (explorer *packageExplorer) getResultFromStruct(s *structType) *parseResult {
	if s.typeFromMethod != nil {
		return &parseResult{
			entType: s.typeFromMethod,
			pkgPath: s.packagePath,
			private: s.private,
		}
	}

	for _, dep := range s.dependencies {
		pkgPath, structName := dep.pkgPath, dep.ident
		pkg := explorer.pkgMap[pkgPath]
		if pkg == nil {
			// TODO would be nice to have package this struct belongs in here
			return &parseResult{
				err: fmt.Errorf("couldn't find package %s even though it's a dependency for %s", pkgPath, s.name),
			}
		}

		depStruct := pkg.structMap[structName]
		if depStruct == nil {
			// TODO would be nice to have package this stuct belongs in here
			return &parseResult{
				err: fmt.Errorf("couldn't find struct %s in package %s", structName, pkgPath),
			}
		}

		// call this function recursively for this dependency
		// return value if we found typ or err
		if res := explorer.getResultFromStruct(depStruct); res != nil {
			return res
		}
	}
	// another place where pkgName would be useful
	return &parseResult{
		err: fmt.Errorf("couldn't figure out typ for %s", s.name),
	}
}

func newPackageType(pkg *packages.Package) *packageType {
	ret := &packageType{pkg: pkg}
	ret.structMap = make(map[string]*structType)
	ret.funcMap = make(map[string]string)
	ret.funcTypeOverride = make(map[string]types.Type)
	return ret
}

type packageType struct {
	pkg              *packages.Package
	structMap        map[string]*structType
	funcMap          map[string]string
	funcTypeOverride map[string]types.Type

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
func (t *packageType) addFuncToStructMap(funcName, structName string) {
	t.funcMap[funcName] = structName
}

// add a mapping from function name to type override
// this currently only applies for JSON types so we know what type to generate
// in golang, graphql, etc
func (t *packageType) addFuncTypeOverride(funcName string, typ types.Type) {
	t.funcTypeOverride[funcName] = typ
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

	// is the dataType private directly?
	private bool
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
	"PkgPath": func(_ *packages.Package, s *structType, fn *ast.FuncDecl) {
		retStmt := astparser.GetLastReturnStmtExpr(fn)

		// not a basic lit. this is a complicated case e.g. field.JSONType
		// we'll specially handle that but need to figure out something else
		// for other cases.
		// Here's another scenario where AST parsing is a liability instead of just running the code
		_, ok := retStmt.(*ast.BasicLit)
		if !ok {
			return
		}

		s.packagePath = astparser.GetUnderylingStringFromLiteralExpr(
			astparser.GetLastReturnStmtExpr(fn),
		)
	},
	// optional. dataType is private, field is private
	"Private": func(pkg *packages.Package, s *structType, fn *ast.FuncDecl) {
		// This only works for literal "return true"
		val := astparser.GetBooleanValueFromExpr(
			astparser.GetLastReturnStmtExpr(fn),
		)
		if val {
			s.private = true
		}
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
	util.GoSchemaKill("couldn't find the right package for function. shouldn't get here")
	// won't get here
	return nil
}
