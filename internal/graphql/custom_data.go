package graphql

import (
	"fmt"

	"github.com/lolopinto/ent/internal/codepath"
	"github.com/lolopinto/ent/internal/tsimport"
)

type CustomData struct {
	Args    map[string]*CustomObject `json:"args,omitempty"`
	Inputs  map[string]*CustomObject `json:"inputs,omitempty"`
	Objects map[string]*CustomObject `json:"objects,omitempty"`
	// map of class to fields in that class
	Fields      map[string][]CustomField    `json:"fields,omitempty"`
	Queries     []CustomField               `json:"queries,omitempty"`
	Mutations   []CustomField               `json:"mutations,omitempty"`
	Classes     map[string]*CustomClassInfo `json:"classes,omitempty"`
	Files       map[string]*CustomFile      `json:"files,omitempty"`
	CustomTypes map[string]*CustomType      `json:"customTypes,omitempty"`
	Error       error                       `json:"-"`
}

type CustomItem struct {
	Name         string                 `json:"name,omitempty"`
	Type         string                 `json:"type,omitempty"`
	Nullable     NullableItem           `json:"nullable,omitempty"`
	List         bool                   `json:"list,omitempty"`
	Connection   bool                   `json:"connection,omitempty"`
	IsContextArg bool                   `json:"isContextArg,omitempty"`
	TSType       string                 `json:"tsType,omitempty"`
	imports      []*tsimport.ImportPath `json:"-"`
}

type CustomScalarInfo struct {
	Description    string `json:"description,omitempty"`
	Name           string `json:"name,omitempty"`
	SpecifiedByURL string `json:"specifiedByUrl,omitempty"`
}

func (cs *CustomScalarInfo) getRenderer(s *gqlSchema) renderer {
	return &scalarRenderer{
		name:           cs.Name,
		description:    cs.Description,
		specifiedByUrl: cs.SpecifiedByURL,
	}
}

type CustomType struct {
	Type       string `json:"type,omitempty"`
	ImportPath string `json:"importPath,omitempty"`

	// custom scalar info. used for schema.gql
	ScalarInfo *CustomScalarInfo `json:"scalarInfo,omitempty"`

	// both of these are optional
	TSType       string `json:"tsType,omitempty"`
	TSImportPath string `json:"tsImportPath,omitempty"`
}

func (item *CustomItem) addImportImpl(imps ...string) {
	for _, imp := range imps {
		// TODO this doesn't work for the new custom types?
		item.imports = append(item.imports, &tsimport.ImportPath{
			ImportPath: "graphql",
			Import:     imp,
		})
	}
}

func (item *CustomItem) initialize() error {
	switch item.Nullable {
	case NullableTrue:
		if item.List {
			item.addImportImpl("GraphQLList", "GraphQLNonNull")
		}

	case NullableContents:
		if !item.List {
			return fmt.Errorf("list required to use this option")
		}
		item.addImportImpl("GraphQLNonNull", "GraphQLList")

	case NullableContentsAndList:
		if !item.List {
			return fmt.Errorf("list required to use this option")
		}
		item.addImportImpl("GraphQLList")

	default:
		if item.List {
			item.addImportImpl("GraphQLNonNull", "GraphQLList", "GraphQLNonNull")
		} else {
			item.addImportImpl("GraphQLNonNull")
		}
	}

	return nil
}

func (item *CustomItem) addImport(imp *tsimport.ImportPath) {
	item.imports = append(item.imports, imp)
}

func (item *CustomItem) getImports(s *gqlSchema, cd *CustomData) ([]*tsimport.ImportPath, error) {
	if err := item.initialize(); err != nil {
		return nil, err
	}

	// TODO need to know if mutation or query...
	imp := s.getImportFor(item.Type, false)
	if imp != nil {
		item.addImport(imp)
	} else {
		_, ok := s.customData.Objects[item.Type]
		if !ok {
			return nil, fmt.Errorf("found a type %s which was not part of the schema", item.Type)
		}
		item.addImport(
			&tsimport.ImportPath{
				Import: fmt.Sprintf("%sType", item.Type),
				// TODO same here. need to know if mutation or query
				ImportPath: codepath.GetImportPathForInternalGQLFile(),
			})
		//				s.nodes[resultre]
		// now we need to figure out where this is from e.g.
		// result.Type a native thing e.g. User so getUserType
		// TODO need to add it to DefaultImport for the entire file...
		// e.g. getImportPathForNode
		// or in cd.Classes and figure that out for what the path should be...
		//				imports = append(imports, fmt.Sprintf("%sType", result.Type))
		//				spew.Dump(result.Type + " needs to be added to import for file...")
	}

	return item.imports, nil
}

type CustomFile struct {
	Imports map[string]*CustomImportInfo `json:"imports,omitempty"`
}

type CustomImportInfo struct {
	Path          string `json:"path,omitempty"`
	DefaultImport bool   `json:"defaultImport,omitempty"`
}
