package schema

import (
	"sort"

	"github.com/lolopinto/ent/internal/codepath"
	"github.com/lolopinto/ent/internal/edge"
)

type PatternInfo struct {
	objWithConsts
	Name       string
	AssocEdges map[string]*edge.AssociationEdge
}

func (p *PatternInfo) GetNodeInstance() string {
	// TODO?...
	return "object"
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

func (p *PatternInfo) GetImportsForQueryBaseFile(s *Schema) ([]ImportPath, error) {
	var ret []ImportPath

	// for each edge, find the node, and then find the downstream edges for those
	for _, edge := range p.AssocEdges {
		if edge.PolymorphicEdge() {
			ret = append(ret, ImportPath{
				Import:      "Ent",
				PackagePath: codepath.Package,
			})
			continue
		}

		node, err := s.GetNodeDataForNode(edge.NodeInfo.Node)
		if err != nil {
			return nil, err
		}
		ret = append(ret, ImportPath{
			Import:      node.Node,
			PackagePath: codepath.GetInternalImportPath(),
		})
		// need a flag of if imported or something
		for _, edge2 := range node.EdgeInfo.Associations {
			ret = append(ret, ImportPath{
				Import:      edge2.TsEdgeQueryName(),
				PackagePath: codepath.GetInternalImportPath(),
			})
		}
	}

	return ret, nil
}
