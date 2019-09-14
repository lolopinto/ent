package schema

import (
	"errors"

	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/internal/action"
	"github.com/lolopinto/ent/internal/edge"
	"github.com/lolopinto/ent/internal/field"
	"github.com/lolopinto/ent/internal/schemaparser"
	"golang.org/x/tools/go/packages"
)

// Schema is the representation of the parsed schema. Has everything needed to
type Schema struct {
	Nodes    NodeMapInfo
	edges    map[string]*ent.AssocEdgeData
	newEdges []*ent.AssocEdgeData
}

// Given a schema file parser, Parse parses the schema to return the completely
// parsed schema
func Parse(p schemaparser.Parser, specificConfigs ...string) *Schema {
	return parse(func(s *Schema) *assocEdgeData {
		return s.Nodes.parseFiles(p, specificConfigs...)
	})
}

func ParsePackage(pkg *packages.Package, specificConfigs ...string) *Schema {
	return parse(func(s *Schema) *assocEdgeData {
		return s.Nodes.parsePackage(pkg, specificConfigs...)
	})
}

func parse(parseFn func(*Schema) *assocEdgeData) *Schema {
	s := &Schema{}
	s.init()
	edgeData := parseFn(s)
	s.edges = edgeData.edgeMap
	s.newEdges = edgeData.newEdges
	return s
}

func (s *Schema) init() {
	s.Nodes = make(map[string]*NodeDataInfo)
}

func (s *Schema) GetNodeDataFromGraphQLName(nodeName string) *NodeData {
	return s.Nodes.getNodeDataFromGraphQLName(nodeName)
}

func (s *Schema) GetActionFromGraphQLName(graphQLName string) action.Action {
	return s.Nodes.getActionFromGraphQLName(graphQLName)
}

// below really only exist for tests but yolo
func (s *Schema) GetAssocEdgeByName(entConfig, edgeName string) (*edge.AssociationEdge, error) {
	info := s.Nodes[entConfig]
	if info == nil {
		return nil, errors.New("invalid EntConfig passed to getAssocEdgeByName")
	}
	ret := info.NodeData.GetAssociationEdgeByName(edgeName)
	if ret == nil {
		return nil, errors.New("error getting edge")
	}
	return ret, nil
}

func (s *Schema) GetFieldByName(entConfig, fieldName string) (*field.Field, error) {
	info := s.Nodes[entConfig]
	if info == nil {
		return nil, errors.New("invalid EntConfig passed to getFieldByName")
	}
	ret := info.NodeData.GetFieldByName(fieldName)
	if ret == nil {
		return nil, errors.New("error getting field")
	}
	return ret, nil
}

// GetNewEdges only exists for testing purposes to differentiate between existing and new edges
func (s *Schema) GetNewEdges() []*ent.AssocEdgeData {
	return s.newEdges
}

// GetEdges returns all the edges in the schema
func (s *Schema) GetEdges() map[string]*ent.AssocEdgeData {
	return s.edges
}
