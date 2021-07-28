package imports

import (
	"fmt"
	"path/filepath"
	"strconv"

	"github.com/lolopinto/ent/internal/util"
)

// inspired by github.com/99designs/gqlgen/codegen/templates

type Import struct {
	Name  string
	Path  string
	Alias string
}

type Imports struct {
	imports []*Import
	//	destDir string
}

func (i *Import) String() string {
	if i.Alias == i.Name {
		return strconv.Quote(i.Path)
	}

	return i.Alias + " " + strconv.Quote(i.Path)
}

func (s *Imports) String() string {
	res := ""
	for i, imp := range s.imports {
		if i != 0 {
			res += "\n"
		}
		res += imp.String()
	}
	return res
}

func nameForPackage(path string) string {
	_, name := filepath.Split(path)
	return name
}

func (s *Imports) Reserve(path string, aliases ...string) (string, error) {
	if path == "" {
		return "", fmt.Errorf("empty ambient import")
	}

	var err error
	if path[0] == '"' {
		path, err = strconv.Unquote(path)
		if err != nil {
			return "", err
		}
	}
	// if we are referencing our own package we dont need an import
	// if code.ImportPathForDir(s.destDir) == path {
	// 	return "", nil
	// }

	// get name for package
	//	name := code.NameForPackage(path)
	name := nameForPackage(path)
	var alias string
	if len(aliases) != 1 {
		alias = name
	} else {
		alias = aliases[0]
	}

	if existing := s.findByPath(path); existing != nil {
		if existing.Alias == alias {
			return "", nil
		}
		return "", fmt.Errorf("ambient import already exists")
	}

	if alias := s.findByAlias(alias); alias != nil {
		return "", fmt.Errorf("ambient import collides on an alias")
	}

	s.imports = append(s.imports, &Import{
		Name:  name,
		Path:  path,
		Alias: alias,
	})

	return "", nil
}

func (s *Imports) Lookup(path string) string {
	if path == "" {
		return ""
	}

	// don't support vendor for now
	//	path = code.NormalizeVendor(path)

	// if we are referencing our own package we dont need an import
	// if code.ImportPathForDir(s.destDir) == path {
	// 	return ""
	// }

	if existing := s.findByPath(path); existing != nil {
		return existing.Alias
	}

	imp := &Import{
		Name: nameForPackage(path),
		//		Name: code.NameForPackage(path),
		Path: path,
	}
	s.imports = append(s.imports, imp)

	// handle mutations specially and create useraction, contactaction etc
	alias := imp.Name
	if alias == "action" {
		dir, _ := filepath.Split(path)
		_, model := filepath.Split(dir)
		modelAlias := model + alias

		if s.findByAlias(modelAlias) == nil {
			imp.Alias = modelAlias
			return imp.Alias
		}
	}

	i := 1
	for s.findByAlias(alias) != nil {
		alias = imp.Name + strconv.Itoa(i)
		i++
		if i > 10 {
			util.GoSchemaKill(fmt.Errorf("too many collisions, last attempt was %s", alias))
		}
	}
	imp.Alias = alias

	return imp.Alias
}

// func (s *Imports) LookupType(t types.Type) string {
// 	return types.TypeString(t, func(i *types.Package) string {
// 		return s.Lookup(i.Path())
// 	})
// }

func (s Imports) findByPath(importPath string) *Import {
	for _, imp := range s.imports {
		if imp.Path == importPath {
			return imp
		}
	}
	return nil
}

func (s Imports) findByAlias(alias string) *Import {
	for _, imp := range s.imports {
		if imp.Alias == alias {
			return imp
		}
	}
	return nil
}
