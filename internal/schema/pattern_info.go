package schema

import (
	"fmt"
	"sort"

	"github.com/iancoleman/strcase"
	"github.com/lolopinto/ent/internal/codegen/codegenapi"
	"github.com/lolopinto/ent/internal/codepath"
	"github.com/lolopinto/ent/internal/edge"
	"github.com/lolopinto/ent/internal/field"
	"github.com/lolopinto/ent/internal/names"
	"github.com/lolopinto/ent/internal/tsimport"
)

type PatternInfo struct {
	objWithConsts
	Name         string
	FieldInfo    *field.FieldInfo
	AssocEdges   map[string]*edge.AssociationEdge
	DisableMixin bool
}

func (p *PatternInfo) GetNodeInstance() string {
	// TODO?...
	return "object"
}

// the main value that currently exists for mixins with no fields seems to be
// marker interface
func (p *PatternInfo) HasMixin() bool {
	return !p.DisableMixin
}

func (p *PatternInfo) GetMixinBaseFile() string {
	return p.Name + "Base"
}

func (p *PatternInfo) GetSortedEdges() []*edge.AssociationEdge {
	ret := make([]*edge.AssociationEdge, len(p.AssocEdges))
	i := 0
	for _, e := range p.AssocEdges {
		ret[i] = e
		i++
	}
	sort.Slice(ret, func(i, j int) bool {
		return ret[i].EdgeName < ret[j].EdgeName
	})
	return ret
}

// borrowed for builder.tmpl
func (p *PatternInfo) GetImportsForQueryBaseFile(s *Schema) ([]*tsimport.ImportPath, error) {
	var ret []*tsimport.ImportPath

	// for each edge, find the node, and then find the downstream edges for those
	for _, edge := range p.AssocEdges {
		if edge.PolymorphicEdge() {
			ret = append(ret, &tsimport.ImportPath{
				Import:     "Ent",
				ImportPath: codepath.Package,
			})
			continue
		}

		node, err := s.GetNodeDataForNode(edge.NodeInfo.Node)
		if err != nil {
			return nil, err
		}
		ret = append(ret, &tsimport.ImportPath{
			Import:     node.Node,
			ImportPath: codepath.GetInternalImportPath(),
		})
		// need a flag of if imported or something
		for _, edge2 := range node.EdgeInfo.Associations {
			ret = append(ret, &tsimport.ImportPath{
				Import:     edge2.TsEdgeQueryName(),
				ImportPath: codepath.GetInternalImportPath(),
			})
		}
	}

	return ret, nil
}

func (p *PatternInfo) GetMixinInterfaceName() string {
	return names.ToClassType("I", p.Name)
}

func (p *PatternInfo) GetMixinInterfaceBaseName() string {
	return names.ToClassType("I", p.Name, "Base")
}

func (p *PatternInfo) GetMixinWithInterfaceName() string {
	return names.ToClassType("IEntWith", p.Name)
}

func (p *PatternInfo) HasBuilder() bool {
	return len(p.AssocEdges) > 0
}

func (p *PatternInfo) GetBuilderName() string {
	return names.ToClassType(p.Name, "Builder")
}

func (p *PatternInfo) GetBuilderInterfaceName() string {
	return names.ToClassType("I", p.Name, "Builder")
}

func (p *PatternInfo) GetMixinName() string {
	return names.ToClassType(p.Name, "Mixin")
}

func (p *PatternInfo) GetMixinBaseName() string {
	return fmt.Sprintf("%sBaseMixin", strcase.ToCamel(p.Name))
}

func (p *PatternInfo) GetPatternMethod() string {
	return names.ToTsFieldName("is", p.Name)
}

func (p *PatternInfo) ForeignImport(imp string) bool {
	// may change if we eventually inline enums again
	// see https://github.com/lolopinto/ent/pull/702/files
	return true
}

func (p *PatternInfo) HasFields() bool {
	return len(p.FieldInfo.EntFields()) > 0
}

func (p *PatternInfo) GetImportsForMixin(s *Schema, cfg codegenapi.Config) []*tsimport.ImportPath {
	var ret []*tsimport.ImportPath

	for _, edge := range p.AssocEdges {
		ret = append(ret, &tsimport.ImportPath{
			Import:     edge.TsEdgeQueryName(),
			ImportPath: codepath.GetInternalImportPath(),
		})
	}

	for _, f := range p.FieldInfo.EntFields() {
		ret = append(ret, f.GetImportsForTypes(cfg, s, s)...)
	}
	return ret
}

// TODO prevent private fields in patterns??
// or handle private fields in patterns and mixins...
// or fields with fieldPrivacy
// https://github.com/lolopinto/ent/issues/911

func (p *PatternInfo) GetImportPathForMixinBase() string {
	return fmt.Sprintf("src/ent/generated/mixins/%s", strcase.ToSnake(p.GetMixinBaseFile()))
}
