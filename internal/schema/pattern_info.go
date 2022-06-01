package schema

import (
	"fmt"
	"sort"
	"strings"

	"github.com/iancoleman/strcase"
	"github.com/lolopinto/ent/internal/codepath"
	"github.com/lolopinto/ent/internal/edge"
	"github.com/lolopinto/ent/internal/field"
	"github.com/lolopinto/ent/internal/tsimport"
)

type PatternInfo struct {
	objWithConsts
	Name       string
	FieldInfo  *field.FieldInfo
	AssocEdges map[string]*edge.AssociationEdge
}

func (p *PatternInfo) GetNodeInstance() string {
	// TODO?...
	return "object"
}

func hasMixin(name string) bool {
	// TODO need a flag to disable this
	// don't want this for node, etc
	return !strings.Contains(name, "node")
}

func getMixinName(name string) string {
	// TODO handle Name with conflicts...
	// DayOfWeek mixin vs day of week enum...
	return fmt.Sprintf("%sMixin", strcase.ToCamel(name))
}

func getBuilderMixinName(name string) string {
	return fmt.Sprintf("%sBuilder", strcase.ToCamel(name))
}

func (p *PatternInfo) HasMixin() bool {
	return hasMixin(p.Name)

	// TODO seemingly no value for mixins without fields
	// only those with edges
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
	return fmt.Sprintf("I%s", strcase.ToCamel(p.Name))
}

func (p *PatternInfo) GetMixinWithInterfaceName() string {
	return fmt.Sprintf("IEntWith%s", strcase.ToCamel(p.Name))
}

func (p *PatternInfo) HasBuilder() bool {
	return len(p.AssocEdges) > 0
}

func (p *PatternInfo) GetBuilderName() string {
	return getBuilderMixinName(p.Name)
}

func (p *PatternInfo) GetBuilderInterfaceName() string {
	return fmt.Sprintf("I%sBuilder", strcase.ToCamel(p.Name))
}

func (p *PatternInfo) GetMixinName() string {
	return getMixinName(p.Name)
}

func (p *PatternInfo) GetPatternMethod() string {
	return fmt.Sprintf("is%s", strcase.ToCamel(p.Name))
}

func (p *PatternInfo) ForeignImport(imp string) bool {
	// may change if we eventually inline enums again
	// see https://github.com/lolopinto/ent/pull/702/files
	return true
}

func (p *PatternInfo) HasFields() bool {
	return len(p.FieldInfo.Fields) > 0
}

func (p *PatternInfo) GetImportsForMixin() []*tsimport.ImportPath {
	var ret []*tsimport.ImportPath

	for _, edge := range p.AssocEdges {
		ret = append(ret, &tsimport.ImportPath{
			Import:     edge.TsEdgeQueryName(),
			ImportPath: codepath.GetInternalImportPath(),
		})
	}
	return ret
}

// TODO prevent private fields in patterns??
// or handle private fields in patterns and mixins...
// or fields with fieldPrivacy
