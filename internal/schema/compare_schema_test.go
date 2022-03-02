package schema_test

import (
	"encoding/json"
	"testing"

	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/internal/action"
	"github.com/lolopinto/ent/internal/codegen/nodeinfo"
	"github.com/lolopinto/ent/internal/edge"
	"github.com/lolopinto/ent/internal/field"
	"github.com/lolopinto/ent/internal/schema"
	"github.com/lolopinto/ent/internal/schema/base"
	"github.com/lolopinto/ent/internal/schema/change"
	"github.com/lolopinto/ent/internal/schema/input"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCompareEmpty(t *testing.T) {
	m, err := schema.CompareSchemas(nil, nil)
	require.Nil(t, err)
	require.Nil(t, m)

	m, err = schema.CompareSchemas(nil, &schema.Schema{})
	require.Nil(t, err)
	require.Nil(t, m)

	m, err = schema.CompareSchemas(&schema.Schema{}, nil)
	require.Nil(t, err)
	require.Nil(t, m)
}

func TestComparePatternsNoChange(t *testing.T) {
	s1 := &schema.Schema{
		Patterns: map[string]*schema.PatternInfo{
			"node": {
				Name: "Node",
			},
		},
	}
	s2 := &schema.Schema{
		Patterns: map[string]*schema.PatternInfo{
			"node": {
				Name: "Node",
			},
		},
	}
	m, err := schema.CompareSchemas(s1, s2)
	require.Nil(t, err)
	require.Len(t, m, 0)
}

func TestCompareAddedPattern(t *testing.T) {
	s1 := &schema.Schema{}
	s2 := &schema.Schema{
		Patterns: map[string]*schema.PatternInfo{
			"node": {
				Name: "Node",
			},
		},
	}
	m, err := schema.CompareSchemas(s1, s2)
	require.Nil(t, err)
	require.Len(t, m, 1)

	node := m["node"]
	require.Len(t, node, 1)
	verifyChange(t, change.Change{
		Change:  change.AddPattern,
		Pattern: "node",
	}, node[0])
}

func TestCompareRemovedPattern(t *testing.T) {
	s1 := &schema.Schema{
		Patterns: map[string]*schema.PatternInfo{
			"node": {
				Name: "Node",
			},
		},
	}
	s2 := &schema.Schema{}
	m, err := schema.CompareSchemas(s1, s2)
	require.Nil(t, err)
	require.Len(t, m, 1)

	node := m["node"]
	require.Len(t, node, 1)
	verifyChange(t, change.Change{
		Change:  change.RemovePattern,
		Pattern: "node",
	}, node[0])
}

func TestComparePatternsWithEdgesNoChange(t *testing.T) {
	edge1, edge2 := createDuplicateAssocEdgeFromInput(t, "user", &input.AssocEdge{
		Name:       "Likes",
		SchemaName: "User",
	})
	s1 := &schema.Schema{
		Patterns: map[string]*schema.PatternInfo{
			"feedback": {
				Name: "Feedback",
				AssocEdges: map[string]*edge.AssociationEdge{
					"likes": edge1,
				},
			},
		},
	}
	s2 := &schema.Schema{
		Patterns: map[string]*schema.PatternInfo{
			"feedback": {
				Name: "Feedback",
				AssocEdges: map[string]*edge.AssociationEdge{
					"likes": edge2,
				},
			},
		},
	}
	m, err := schema.CompareSchemas(s1, s2)
	require.Nil(t, err)
	require.Len(t, m, 0)
}

func TestComparePatternsWithAddedEdge(t *testing.T) {
	edge1, err := edge.AssocEdgeFromInput("user", &input.AssocEdge{
		Name:       "Likes",
		SchemaName: "User",
	})
	require.Nil(t, err)
	s1 := &schema.Schema{
		Patterns: map[string]*schema.PatternInfo{
			"feedback": {
				Name: "Feedback",
			},
		},
	}
	s2 := &schema.Schema{
		Patterns: map[string]*schema.PatternInfo{
			"feedback": {
				Name: "Feedback",
				AssocEdges: map[string]*edge.AssociationEdge{
					"likes": edge1,
				},
			},
		},
	}
	m, err := schema.CompareSchemas(s1, s2)
	require.Nil(t, err)
	require.Len(t, m, 1)
	feedback := m["feedback"]
	require.Len(t, feedback, 1)
	verifyChange(t, change.Change{
		Change: change.AddEdge,
		Edge:   "likes",
	}, feedback[0])
}

func TestComparePatternsWithRemovedEdge(t *testing.T) {
	edge1, err := edge.AssocEdgeFromInput("user", &input.AssocEdge{
		Name:       "Likes",
		SchemaName: "User",
	})
	require.Nil(t, err)
	s1 := &schema.Schema{
		Patterns: map[string]*schema.PatternInfo{
			"feedback": {
				Name: "Feedback",
				AssocEdges: map[string]*edge.AssociationEdge{
					"likes": edge1,
				},
			},
		},
	}
	s2 := &schema.Schema{
		Patterns: map[string]*schema.PatternInfo{
			"feedback": {
				Name: "Feedback",
			},
		},
	}
	m, err := schema.CompareSchemas(s1, s2)
	require.Nil(t, err)
	require.Len(t, m, 1)
	feedback := m["feedback"]
	require.Len(t, feedback, 1)
	verifyChange(t, change.Change{
		Change: change.RemoveEdge,
		Edge:   "likes",
	}, feedback[0])
}

func TestComparePatternsWithModifiedEdge(t *testing.T) {
	edge1, err := edge.AssocEdgeFromInput("user", &input.AssocEdge{
		Name:       "Likes",
		SchemaName: "User",
	})
	require.Nil(t, err)
	edge2, err := edge.AssocEdgeFromInput("user", &input.AssocEdge{
		Name:       "Likes",
		SchemaName: "User",
		InverseEdge: &input.InverseAssocEdge{
			Name: "likedObjects",
		},
	})
	require.Nil(t, err)

	s1 := &schema.Schema{
		Patterns: map[string]*schema.PatternInfo{
			"feedback": {
				Name: "Feedback",
				AssocEdges: map[string]*edge.AssociationEdge{
					"likes": edge1,
				},
			},
		},
	}
	s2 := &schema.Schema{
		Patterns: map[string]*schema.PatternInfo{
			"feedback": {
				Name: "Feedback",
				AssocEdges: map[string]*edge.AssociationEdge{
					"likes": edge2,
				},
			},
		},
	}
	m, err := schema.CompareSchemas(s1, s2)
	require.Nil(t, err)
	require.Len(t, m, 1)
	feedback := m["feedback"]
	require.Len(t, feedback, 1)
	verifyChange(t, change.Change{
		Change: change.ModifyEdge,
		Edge:   "likes",
	}, feedback[0])
}

func TestCompareAddNode(t *testing.T) {
	s1 := &schema.Schema{}
	s2 := &schema.Schema{
		Nodes: map[string]*schema.NodeDataInfo{
			"User": {
				NodeData: &schema.NodeData{
					NodeInfo:    nodeinfo.GetNodeInfo("user"),
					PackageName: "user",
				},
			},
		},
	}

	m, err := schema.CompareSchemas(s1, s2)
	require.Nil(t, err)
	require.Len(t, m, 1)
	user := m["User"]
	require.Len(t, user, 1)
	verifyChange(t, change.Change{
		Change: change.AddNode,
		Node:   "User",
	}, user[0])
}

func TestCompareRemoveNode(t *testing.T) {
	s1 := &schema.Schema{
		Nodes: map[string]*schema.NodeDataInfo{
			"User": {
				NodeData: &schema.NodeData{
					NodeInfo:    nodeinfo.GetNodeInfo("user"),
					PackageName: "user",
				},
			},
		},
	}
	s2 := &schema.Schema{}

	m, err := schema.CompareSchemas(s1, s2)
	require.Nil(t, err)
	require.Len(t, m, 1)
	user := m["User"]
	require.Len(t, user, 1)
	verifyChange(t, change.Change{
		Change: change.RemoveNode,
		Node:   "User",
	}, user[0])
}

func TestCompareNodesNoChange(t *testing.T) {
	s1 := &schema.Schema{
		Nodes: map[string]*schema.NodeDataInfo{
			"User": {
				NodeData: &schema.NodeData{
					NodeInfo:    nodeinfo.GetNodeInfo("user"),
					PackageName: "user",
				},
			},
		},
	}
	s2 := &schema.Schema{
		Nodes: map[string]*schema.NodeDataInfo{
			"User": {
				NodeData: &schema.NodeData{
					NodeInfo:    nodeinfo.GetNodeInfo("user"),
					PackageName: "user",
				},
			},
		},
	}

	m, err := schema.CompareSchemas(s1, s2)
	require.Nil(t, err)
	require.Len(t, m, 0)
}

func TestCompareNodesAddField(t *testing.T) {
	s1 := &schema.Schema{
		Nodes: map[string]*schema.NodeDataInfo{
			"User": {
				NodeData: &schema.NodeData{
					NodeInfo:    nodeinfo.GetNodeInfo("user"),
					PackageName: "user",
				},
			},
		},
	}
	fi, err := field.NewFieldInfoFromInputs([]*input.Field{
		{
			Name: "first_name",
			Type: &input.FieldType{
				DBType: input.String,
			},
		},
		{
			Name: "last_name",
			Type: &input.FieldType{
				DBType: input.String,
			},
		},
	}, &field.Options{})
	require.Nil(t, err)
	s2 := &schema.Schema{
		Nodes: map[string]*schema.NodeDataInfo{
			"User": {
				NodeData: &schema.NodeData{
					NodeInfo:    nodeinfo.GetNodeInfo("user"),
					PackageName: "user",
					FieldInfo:   fi,
				},
			},
		},
	}

	m, err := schema.CompareSchemas(s1, s2)
	require.Nil(t, err)
	require.Len(t, m, 1)

	user := m["User"]
	require.Len(t, user, 3)
	// map order means this isn't consistent...
	var firstIdx, lastIdx int
	if user[0].Field == "first_name" {
		firstIdx = 0
		lastIdx = 1
	} else {
		firstIdx = 1
		lastIdx = 0
	}
	verifyChange(t, change.Change{
		Change: change.AddField,
		Field:  "first_name",
	}, user[firstIdx])
	verifyChange(t, change.Change{
		Change: change.AddField,
		Field:  "last_name",
	}, user[lastIdx])

	verifyChange(t, change.Change{
		Change: change.ModifyNode,
		Node:   "User",
	}, user[2])
}

func TestCompareNodesRemoveField(t *testing.T) {
	fi1, err := field.NewFieldInfoFromInputs([]*input.Field{
		{
			Name: "first_name",
			Type: &input.FieldType{
				DBType: input.String,
			},
		},
		{
			Name: "last_name",
			Type: &input.FieldType{
				DBType: input.String,
			},
		},
	}, &field.Options{})
	require.Nil(t, err)
	s1 := &schema.Schema{
		Nodes: map[string]*schema.NodeDataInfo{
			"User": {
				NodeData: &schema.NodeData{
					NodeInfo:    nodeinfo.GetNodeInfo("user"),
					PackageName: "user",
					FieldInfo:   fi1,
				},
			},
		},
	}

	fi2, err := field.NewFieldInfoFromInputs([]*input.Field{
		{
			Name: "first_name",
			Type: &input.FieldType{
				DBType: input.String,
			},
		},
	}, &field.Options{})
	require.Nil(t, err)
	s2 := &schema.Schema{
		Nodes: map[string]*schema.NodeDataInfo{
			"User": {
				NodeData: &schema.NodeData{
					NodeInfo:    nodeinfo.GetNodeInfo("user"),
					PackageName: "user",
					FieldInfo:   fi2,
				},
			},
		},
	}

	m, err := schema.CompareSchemas(s1, s2)
	require.Nil(t, err)
	require.Len(t, m, 1)

	user := m["User"]
	require.Len(t, user, 2)
	verifyChange(t, change.Change{
		Change: change.RemoveField,
		Field:  "last_name",
	}, user[0])
	verifyChange(t, change.Change{
		Change: change.ModifyNode,
		Node:   "User",
	}, user[1])
}

func TestCompareNodesModifyField(t *testing.T) {
	fi1, err := field.NewFieldInfoFromInputs([]*input.Field{
		{
			Name: "first_name",
			Type: &input.FieldType{
				DBType: input.String,
			},
		},
	}, &field.Options{})
	require.Nil(t, err)
	s1 := &schema.Schema{
		Nodes: map[string]*schema.NodeDataInfo{
			"User": {
				NodeData: &schema.NodeData{
					NodeInfo:    nodeinfo.GetNodeInfo("user"),
					PackageName: "user",
					FieldInfo:   fi1,
				},
			},
		},
	}

	fi2, err := field.NewFieldInfoFromInputs([]*input.Field{
		{
			Name: "first_name",
			Type: &input.FieldType{
				DBType: input.String,
			},
			Nullable: true,
		},
	}, &field.Options{})
	require.Nil(t, err)
	s2 := &schema.Schema{
		Nodes: map[string]*schema.NodeDataInfo{
			"User": {
				NodeData: &schema.NodeData{
					NodeInfo:    nodeinfo.GetNodeInfo("user"),
					PackageName: "user",
					FieldInfo:   fi2,
				},
			},
		},
	}

	m, err := schema.CompareSchemas(s1, s2)
	require.Nil(t, err)
	require.Len(t, m, 1)

	user := m["User"]
	require.Len(t, user, 2)
	verifyChange(t, change.Change{
		Change: change.ModifyField,
		Field:  "first_name",
	}, user[0])
	verifyChange(t, change.Change{
		Change: change.ModifyNode,
		Node:   "User",
	}, user[1])
}

func TestCompareNodesWithEdgesNoChange(t *testing.T) {
	e1, err := edge.EdgeInfoFromInput("user", &input.Node{
		AssocEdges: []*input.AssocEdge{
			{
				Name:       "Likes",
				SchemaName: "User",
			},
		},
	})
	require.Nil(t, err)
	e2, err := edge.EdgeInfoFromInput("user", &input.Node{
		AssocEdges: []*input.AssocEdge{
			{
				Name:       "Likes",
				SchemaName: "User",
			},
		},
	})
	require.Nil(t, err)
	s1 := &schema.Schema{
		Nodes: map[string]*schema.NodeDataInfo{
			"User": {
				NodeData: &schema.NodeData{
					NodeInfo:    nodeinfo.GetNodeInfo("user"),
					PackageName: "user",
					EdgeInfo:    e1,
				},
			},
		},
	}
	s2 := &schema.Schema{
		Nodes: map[string]*schema.NodeDataInfo{
			"User": {
				NodeData: &schema.NodeData{
					NodeInfo:    nodeinfo.GetNodeInfo("user"),
					PackageName: "user",
					EdgeInfo:    e2,
				},
			},
		},
	}
	m, err := schema.CompareSchemas(s1, s2)
	require.Nil(t, err)
	require.Len(t, m, 0)
}

func TestCompareNodesWithEdgesAdded(t *testing.T) {
	e2, err := edge.EdgeInfoFromInput("user", &input.Node{
		AssocEdges: []*input.AssocEdge{
			{
				Name:       "Likes",
				SchemaName: "User",
			},
		},
	})
	require.Nil(t, err)
	s1 := &schema.Schema{
		Nodes: map[string]*schema.NodeDataInfo{
			"User": {
				NodeData: &schema.NodeData{
					NodeInfo:    nodeinfo.GetNodeInfo("user"),
					PackageName: "user",
					EdgeInfo:    edge.NewEdgeInfo("user"),
				},
			},
		},
	}
	s2 := &schema.Schema{
		Nodes: map[string]*schema.NodeDataInfo{
			"User": {
				NodeData: &schema.NodeData{
					NodeInfo:    nodeinfo.GetNodeInfo("user"),
					PackageName: "user",
					EdgeInfo:    e2,
				},
			},
		},
	}
	m, err := schema.CompareSchemas(s1, s2)
	require.Nil(t, err)
	require.Len(t, m, 1)

	user := m["User"]
	require.Len(t, user, 2)
	verifyChange(t, change.Change{
		Change: change.AddEdge,
		Edge:   "Likes",
	}, user[0])
	verifyChange(t, change.Change{
		Change: change.ModifyNode,
		Node:   "User",
	}, user[1])
}

func TestCompareNodesWithRemovedEdge(t *testing.T) {
	e1, err := edge.EdgeInfoFromInput("user", &input.Node{
		AssocEdges: []*input.AssocEdge{
			{
				Name:       "Likes",
				SchemaName: "User",
			},
		},
	})
	require.Nil(t, err)
	s1 := &schema.Schema{
		Nodes: map[string]*schema.NodeDataInfo{
			"User": {
				NodeData: &schema.NodeData{
					NodeInfo:    nodeinfo.GetNodeInfo("user"),
					PackageName: "user",
					EdgeInfo:    e1,
				},
			},
		},
	}
	s2 := &schema.Schema{
		Nodes: map[string]*schema.NodeDataInfo{
			"User": {
				NodeData: &schema.NodeData{
					NodeInfo:    nodeinfo.GetNodeInfo("user"),
					PackageName: "user",
				},
			},
		},
	}
	m, err := schema.CompareSchemas(s1, s2)
	require.Nil(t, err)
	require.Len(t, m, 1)

	user := m["User"]
	require.Len(t, user, 2)
	verifyChange(t, change.Change{
		Change: change.RemoveEdge,
		Edge:   "Likes",
	}, user[0])
	verifyChange(t, change.Change{
		Change: change.ModifyNode,
		Node:   "User",
	}, user[1])
}

func TestCompareNodesWithModifiedEdge(t *testing.T) {
	e1, err := edge.EdgeInfoFromInput("user", &input.Node{
		AssocEdges: []*input.AssocEdge{
			{
				Name:       "Likes",
				SchemaName: "User",
			},
		},
	})
	require.Nil(t, err)
	e2, err := edge.EdgeInfoFromInput("user", &input.Node{
		AssocEdges: []*input.AssocEdge{
			{
				Name:       "Likes",
				SchemaName: "User",
				InverseEdge: &input.InverseAssocEdge{
					Name: "likedObjects",
				},
			},
		},
	})
	require.Nil(t, err)
	s1 := &schema.Schema{
		Nodes: map[string]*schema.NodeDataInfo{
			"User": {
				NodeData: &schema.NodeData{
					NodeInfo:    nodeinfo.GetNodeInfo("user"),
					PackageName: "user",
					EdgeInfo:    e1,
				},
			},
		},
	}
	s2 := &schema.Schema{
		Nodes: map[string]*schema.NodeDataInfo{
			"User": {
				NodeData: &schema.NodeData{
					NodeInfo:    nodeinfo.GetNodeInfo("user"),
					PackageName: "user",
					EdgeInfo:    e2,
				},
			},
		},
	}
	m, err := schema.CompareSchemas(s1, s2)
	require.Nil(t, err)
	require.Len(t, m, 1)

	user := m["User"]
	require.Len(t, user, 2)
	verifyChange(t, change.Change{
		Change: change.ModifyEdge,
		Edge:   "Likes",
	}, user[0])
	verifyChange(t, change.Change{
		Change: change.ModifyNode,
		Node:   "User",
	}, user[1])
}

func TestCompareNodesWithEdgeGroupNoChange(t *testing.T) {
	e1, err := edge.EdgeInfoFromInput("user", &input.Node{
		AssocEdgeGroups: []*input.AssocEdgeGroup{
			{
				Name:            "Friendships",
				GroupStatusName: "FriendshipStatus",
				AssocEdges: []*input.AssocEdge{
					{
						Name:       "Friends",
						SchemaName: "User",
						Symmetric:  true,
					},
					{
						Name:       "FriendRequestsSent",
						SchemaName: "User",
						InverseEdge: &input.InverseAssocEdge{
							Name: "FriendRequestsReceived",
						},
					},
				},
			},
		},
	})
	require.Nil(t, err)
	e2, err := edge.EdgeInfoFromInput("user", &input.Node{
		AssocEdgeGroups: []*input.AssocEdgeGroup{
			{
				Name:            "Friendships",
				GroupStatusName: "FriendshipStatus",
				AssocEdges: []*input.AssocEdge{
					{
						Name:       "Friends",
						SchemaName: "User",
						Symmetric:  true,
					},
					{
						Name:       "FriendRequestsSent",
						SchemaName: "User",
						InverseEdge: &input.InverseAssocEdge{
							Name: "FriendRequestsReceived",
						},
					},
				},
			},
		},
	})
	require.Nil(t, err)
	s1 := &schema.Schema{
		Nodes: map[string]*schema.NodeDataInfo{
			"User": {
				NodeData: &schema.NodeData{
					NodeInfo:    nodeinfo.GetNodeInfo("user"),
					PackageName: "user",
					EdgeInfo:    e1,
				},
			},
		},
	}
	s2 := &schema.Schema{
		Nodes: map[string]*schema.NodeDataInfo{
			"User": {
				NodeData: &schema.NodeData{
					NodeInfo:    nodeinfo.GetNodeInfo("user"),
					PackageName: "user",
					EdgeInfo:    e2,
				},
			},
		},
	}
	m, err := schema.CompareSchemas(s1, s2)
	require.Nil(t, err)
	require.Len(t, m, 0)
}

func TestCompareNodesWithEdgeGroupAdded(t *testing.T) {
	e2, err := edge.EdgeInfoFromInput("user", &input.Node{
		AssocEdgeGroups: []*input.AssocEdgeGroup{
			{
				Name:            "Friendships",
				GroupStatusName: "FriendshipStatus",
				AssocEdges: []*input.AssocEdge{
					{
						Name:       "Friends",
						SchemaName: "User",
						Symmetric:  true,
					},
					{
						Name:       "FriendRequestsSent",
						SchemaName: "User",
						InverseEdge: &input.InverseAssocEdge{
							Name: "FriendRequestsReceived",
						},
					},
				},
			},
		},
	})
	require.Nil(t, err)
	s1 := &schema.Schema{
		Nodes: map[string]*schema.NodeDataInfo{
			"User": {
				NodeData: &schema.NodeData{
					NodeInfo:    nodeinfo.GetNodeInfo("user"),
					PackageName: "user",
				},
			},
		},
	}
	s2 := &schema.Schema{
		Nodes: map[string]*schema.NodeDataInfo{
			"User": {
				NodeData: &schema.NodeData{
					NodeInfo:    nodeinfo.GetNodeInfo("user"),
					PackageName: "user",
					EdgeInfo:    e2,
				},
			},
		},
	}
	m, err := schema.CompareSchemas(s1, s2)
	require.Nil(t, err)
	require.Len(t, m, 1)

	user := m["User"]
	require.Len(t, user, 4)
	// also has 2 edges added
	verifyChange(t, change.Change{
		Change:    change.AddEdgeGroup,
		EdgeGroup: "FriendshipStatus",
	}, user[2])
	verifyChange(t, change.Change{
		Change: change.ModifyNode,
		Node:   "User",
	}, user[3])
}

func TestCompareNodesWithEdgeGroupRemoved(t *testing.T) {
	e1, err := edge.EdgeInfoFromInput("user", &input.Node{
		AssocEdgeGroups: []*input.AssocEdgeGroup{
			{
				Name:            "Friendships",
				GroupStatusName: "FriendshipStatus",
				AssocEdges: []*input.AssocEdge{
					{
						Name:       "Friends",
						SchemaName: "User",
						Symmetric:  true,
					},
					{
						Name:       "FriendRequestsSent",
						SchemaName: "User",
						InverseEdge: &input.InverseAssocEdge{
							Name: "FriendRequestsReceived",
						},
					},
				},
			},
		},
	})
	require.Nil(t, err)
	s1 := &schema.Schema{
		Nodes: map[string]*schema.NodeDataInfo{
			"User": {
				NodeData: &schema.NodeData{
					NodeInfo:    nodeinfo.GetNodeInfo("user"),
					PackageName: "user",
					EdgeInfo:    e1,
				},
			},
		},
	}
	s2 := &schema.Schema{
		Nodes: map[string]*schema.NodeDataInfo{
			"User": {
				NodeData: &schema.NodeData{
					NodeInfo:    nodeinfo.GetNodeInfo("user"),
					PackageName: "user",
				},
			},
		},
	}
	m, err := schema.CompareSchemas(s1, s2)
	require.Nil(t, err)
	require.Len(t, m, 1)

	user := m["User"]
	require.Len(t, user, 4)
	// also has 2 edges removed
	verifyChange(t, change.Change{
		Change:    change.RemoveEdgeGroup,
		EdgeGroup: "FriendshipStatus",
	}, user[2])
	verifyChange(t, change.Change{
		Change: change.ModifyNode,
		Node:   "User",
	}, user[3])
}

func TestCompareNodesWithEdgeGroupModified(t *testing.T) {
	e1, err := edge.EdgeInfoFromInput("user", &input.Node{
		AssocEdgeGroups: []*input.AssocEdgeGroup{
			{
				Name:            "Friendships",
				GroupStatusName: "FriendshipStatus",
				AssocEdges: []*input.AssocEdge{
					{
						Name:       "Friends",
						SchemaName: "User",
						Symmetric:  true,
					},
					{
						Name:       "FriendRequestsSent",
						SchemaName: "User",
						InverseEdge: &input.InverseAssocEdge{
							Name: "FriendRequestsReceived",
						},
					},
				},
			},
		},
	})
	require.Nil(t, err)
	e2, err := edge.EdgeInfoFromInput("user", &input.Node{
		AssocEdgeGroups: []*input.AssocEdgeGroup{
			{
				// contrived change to show something simple changing. GroupStatusName is what we key by
				Name:            "friends",
				GroupStatusName: "FriendshipStatus",
				// keep the table name the same since we should be storing the data in the same table
				// TODO we should probably confirm this for any edge change as a prompt...
				TableName: "user_friendships_edges",
				AssocEdges: []*input.AssocEdge{
					{
						Name:       "Friends",
						SchemaName: "User",
						Symmetric:  true,
					},
					{
						Name:       "FriendRequestsSent",
						SchemaName: "User",
						InverseEdge: &input.InverseAssocEdge{
							Name: "FriendRequestsReceived",
						},
					},
				},
			},
		},
	})
	require.Nil(t, err)
	s1 := &schema.Schema{
		Nodes: map[string]*schema.NodeDataInfo{
			"User": {
				NodeData: &schema.NodeData{
					NodeInfo:    nodeinfo.GetNodeInfo("user"),
					PackageName: "user",
					EdgeInfo:    e1,
				},
			},
		},
	}
	s2 := &schema.Schema{
		Nodes: map[string]*schema.NodeDataInfo{
			"User": {
				NodeData: &schema.NodeData{
					NodeInfo:    nodeinfo.GetNodeInfo("user"),
					PackageName: "user",
					EdgeInfo:    e2,
				},
			},
		},
	}
	m, err := schema.CompareSchemas(s1, s2)
	require.Nil(t, err)
	require.Len(t, m, 1)

	user := m["User"]
	require.Len(t, user, 2)
	verifyChange(t, change.Change{
		Change:    change.ModifyEdgeGroup,
		EdgeGroup: "FriendshipStatus",
	}, user[0])
	verifyChange(t, change.Change{
		Change: change.ModifyNode,
		Node:   "User",
	}, user[1])
}

func TestCompareNodesWithEdgeGroupRenamed(t *testing.T) {
	e1, err := edge.EdgeInfoFromInput("user", &input.Node{
		AssocEdgeGroups: []*input.AssocEdgeGroup{
			{
				Name:            "Friendships",
				GroupStatusName: "FriendshipStatus",
				AssocEdges: []*input.AssocEdge{
					{
						Name:       "Friends",
						SchemaName: "User",
						Symmetric:  true,
					},
					{
						Name:       "FriendRequestsSent",
						SchemaName: "User",
						InverseEdge: &input.InverseAssocEdge{
							Name: "FriendRequestsReceived",
						},
					},
				},
			},
		},
	})
	require.Nil(t, err)
	e2, err := edge.EdgeInfoFromInput("user", &input.Node{
		AssocEdgeGroups: []*input.AssocEdgeGroup{
			{
				Name:            "connection",
				GroupStatusName: "ConnectionStatus",
				AssocEdges: []*input.AssocEdge{
					{
						Name:       "Friends",
						SchemaName: "User",
						Symmetric:  true,
					},
					{
						Name:       "FriendRequestsSent",
						SchemaName: "User",
						InverseEdge: &input.InverseAssocEdge{
							Name: "FriendRequestsReceived",
						},
					},
					{
						Name:       "Following",
						SchemaName: "User",
						InverseEdge: &input.InverseAssocEdge{
							Name: "Followers",
						},
					},
				},
			},
		},
	})
	require.Nil(t, err)
	s1 := &schema.Schema{
		Nodes: map[string]*schema.NodeDataInfo{
			"User": {
				NodeData: &schema.NodeData{
					NodeInfo:    nodeinfo.GetNodeInfo("user"),
					PackageName: "user",
					EdgeInfo:    e1,
				},
			},
		},
	}
	s2 := &schema.Schema{
		Nodes: map[string]*schema.NodeDataInfo{
			"User": {
				NodeData: &schema.NodeData{
					NodeInfo:    nodeinfo.GetNodeInfo("user"),
					PackageName: "user",
					EdgeInfo:    e2,
				},
			},
		},
	}
	m, err := schema.CompareSchemas(s1, s2)
	require.Nil(t, err)
	require.Len(t, m, 1)

	user := m["User"]
	require.Len(t, user, 6)
	// table name changed since part of new group and table name not overriden
	verifyChange(t, change.Change{
		Change: change.ModifyEdge,
		Edge:   "Friends",
	}, user[0])
	verifyChange(t, change.Change{
		Change: change.ModifyEdge,
		Edge:   "FriendRequestsSent",
	}, user[1])
	verifyChange(t, change.Change{
		Change: change.AddEdge,
		Edge:   "Following",
	}, user[2])
	verifyChange(t, change.Change{
		Change:    change.RemoveEdgeGroup,
		EdgeGroup: "FriendshipStatus",
	}, user[3])
	verifyChange(t, change.Change{
		Change:    change.AddEdgeGroup,
		EdgeGroup: "ConnectionStatus",
	}, user[4])
	verifyChange(t, change.Change{
		Change: change.ModifyNode,
		Node:   "User",
	}, user[5])
}

func TestCompareActionsNoChange(t *testing.T) {
	a1 := createActionInfoFromInput(t, "user", &input.Node{
		Fields: []*input.Field{
			{
				Name: "first_name",
				Type: &input.FieldType{
					DBType: input.String,
				},
			},
		},
		Actions: []*input.Action{
			{
				Operation: ent.CreateAction,
			},
		},
	})
	a2 := createActionInfoFromInput(t, "user", &input.Node{
		Fields: []*input.Field{
			{
				Name: "first_name",
				Type: &input.FieldType{
					DBType: input.String,
				},
			},
		},
		Actions: []*input.Action{
			{
				Operation: ent.CreateAction,
			},
		},
	})

	s1 := &schema.Schema{
		Nodes: map[string]*schema.NodeDataInfo{
			"User": {
				NodeData: &schema.NodeData{
					NodeInfo:    nodeinfo.GetNodeInfo("user"),
					PackageName: "user",
					ActionInfo:  a1,
				},
			},
		},
	}
	s2 := &schema.Schema{
		Nodes: map[string]*schema.NodeDataInfo{
			"User": {
				NodeData: &schema.NodeData{
					NodeInfo:    nodeinfo.GetNodeInfo("user"),
					PackageName: "user",
					ActionInfo:  a2,
				},
			},
		},
	}
	m, err := schema.CompareSchemas(s1, s2)
	require.Nil(t, err)
	require.Len(t, m, 0)
}

func TestCompareActionsAdded(t *testing.T) {
	a2 := createActionInfoFromInput(t, "user", &input.Node{
		Fields: []*input.Field{
			{
				Name: "first_name",
				Type: &input.FieldType{
					DBType: input.String,
				},
			},
		},
		Actions: []*input.Action{
			{
				Operation: ent.CreateAction,
			},
		},
	})

	s1 := &schema.Schema{
		Nodes: map[string]*schema.NodeDataInfo{
			"User": {
				NodeData: &schema.NodeData{
					NodeInfo:    nodeinfo.GetNodeInfo("user"),
					PackageName: "user",
				},
			},
		},
	}
	s2 := &schema.Schema{
		Nodes: map[string]*schema.NodeDataInfo{
			"User": {
				NodeData: &schema.NodeData{
					NodeInfo:    nodeinfo.GetNodeInfo("user"),
					PackageName: "user",
					ActionInfo:  a2,
				},
			},
		},
	}
	m, err := schema.CompareSchemas(s1, s2)
	require.Nil(t, err)
	require.Len(t, m, 1)

	user := m["User"]
	require.Len(t, user, 2)
	verifyChange(t, change.Change{
		Change: change.AddAction,
		Action: "CreateUserAction",
	}, user[0])
	verifyChange(t, change.Change{
		Change: change.ModifyNode,
		Node:   "User",
	}, user[1])
}

func TestCompareActionsRemoved(t *testing.T) {
	a1 := createActionInfoFromInput(t, "user", &input.Node{
		Fields: []*input.Field{
			{
				Name: "first_name",
				Type: &input.FieldType{
					DBType: input.String,
				},
			},
		},
		Actions: []*input.Action{
			{
				Operation: ent.CreateAction,
			},
		},
	})

	s1 := &schema.Schema{
		Nodes: map[string]*schema.NodeDataInfo{
			"User": {
				NodeData: &schema.NodeData{
					NodeInfo:    nodeinfo.GetNodeInfo("user"),
					PackageName: "user",
					ActionInfo:  a1,
				},
			},
		},
	}
	s2 := &schema.Schema{
		Nodes: map[string]*schema.NodeDataInfo{
			"User": {
				NodeData: &schema.NodeData{
					NodeInfo:    nodeinfo.GetNodeInfo("user"),
					PackageName: "user",
				},
			},
		},
	}
	m, err := schema.CompareSchemas(s1, s2)
	require.Nil(t, err)
	require.Len(t, m, 1)

	user := m["User"]
	require.Len(t, user, 2)
	verifyChange(t, change.Change{
		Change: change.RemoveAction,
		Action: "CreateUserAction",
	}, user[0])
	verifyChange(t, change.Change{
		Change: change.ModifyNode,
		Node:   "User",
	}, user[1])
}

func TestCompareActionsModified(t *testing.T) {
	a1 := createActionInfoFromInput(t, "user", &input.Node{
		Fields: []*input.Field{
			{
				Name: "name",
				Type: &input.FieldType{
					DBType: input.String,
				},
			},
			{
				Name: "prefs",
				Type: &input.FieldType{
					DBType: input.String,
				},
				Nullable: true,
			},
		},
		Actions: []*input.Action{
			{
				Operation: ent.CreateAction,
			},
		},
	})
	a2 := createActionInfoFromInput(t, "user", &input.Node{
		Fields: []*input.Field{
			{
				Name: "name",
				Type: &input.FieldType{
					DBType: input.String,
				},
			},
			{
				Name: "prefs",
				Type: &input.FieldType{
					DBType: input.String,
				},
				Nullable: true,
			},
		},
		Actions: []*input.Action{
			{
				Operation: ent.CreateAction,
				Fields:    []string{"name"},
			},
		},
	})

	s1 := &schema.Schema{
		Nodes: map[string]*schema.NodeDataInfo{
			"User": {
				NodeData: &schema.NodeData{
					NodeInfo:    nodeinfo.GetNodeInfo("user"),
					PackageName: "user",
					ActionInfo:  a1,
				},
			},
		},
	}
	s2 := &schema.Schema{
		Nodes: map[string]*schema.NodeDataInfo{
			"User": {
				NodeData: &schema.NodeData{
					NodeInfo:    nodeinfo.GetNodeInfo("user"),
					PackageName: "user",
					ActionInfo:  a2,
				},
			},
		},
	}
	m, err := schema.CompareSchemas(s1, s2)
	require.Nil(t, err)
	require.Len(t, m, 1)

	user := m["User"]
	require.Len(t, user, 2)
	verifyChange(t, change.Change{
		Change: change.ModifyAction,
		Action: "CreateUserAction",
	}, user[0])
	verifyChange(t, change.Change{
		Change: change.ModifyNode,
		Node:   "User",
	}, user[1])
}

func TestForeignKeyEdgeNoChange(t *testing.T) {
	e1 := edge.NewEdgeInfo("user")
	require.Nil(t, e1.AddEdgeFromForeignKeyIndex("user_id", "contacts", "User"))

	e2 := edge.NewEdgeInfo("user")
	require.Nil(t, e2.AddEdgeFromForeignKeyIndex("user_id", "contacts", "User"))

	s1 := &schema.Schema{
		Nodes: map[string]*schema.NodeDataInfo{
			"User": {
				NodeData: &schema.NodeData{
					NodeInfo:    nodeinfo.GetNodeInfo("user"),
					PackageName: "user",
					EdgeInfo:    e1,
				},
			},
		},
	}
	s2 := &schema.Schema{
		Nodes: map[string]*schema.NodeDataInfo{
			"User": {
				NodeData: &schema.NodeData{
					NodeInfo:    nodeinfo.GetNodeInfo("user"),
					PackageName: "user",
					EdgeInfo:    e2,
				},
			},
		},
	}
	m, err := schema.CompareSchemas(s1, s2)
	require.Nil(t, err)
	require.Len(t, m, 0)
}

func TestForeignKeyEdgeAdded(t *testing.T) {
	e2 := edge.NewEdgeInfo("user")
	require.Nil(t, e2.AddEdgeFromForeignKeyIndex("user_id", "contacts", "User"))

	s1 := &schema.Schema{
		Nodes: map[string]*schema.NodeDataInfo{
			"User": {
				NodeData: &schema.NodeData{
					NodeInfo:    nodeinfo.GetNodeInfo("user"),
					PackageName: "user",
				},
			},
		},
	}
	s2 := &schema.Schema{
		Nodes: map[string]*schema.NodeDataInfo{
			"User": {
				NodeData: &schema.NodeData{
					NodeInfo:    nodeinfo.GetNodeInfo("user"),
					PackageName: "user",
					EdgeInfo:    e2,
				},
			},
		},
	}
	m, err := schema.CompareSchemas(s1, s2)
	require.Nil(t, err)
	require.Len(t, m, 1)

	user := m["User"]
	require.Len(t, user, 2)
	verifyChange(t, change.Change{
		Change: change.AddEdge,
		Edge:   "contacts",
	}, user[0])
	verifyChange(t, change.Change{
		Change: change.ModifyNode,
		Node:   "User",
	}, user[1])
}

func TestForeignKeyEdgeRemoved(t *testing.T) {
	e1 := edge.NewEdgeInfo("user")
	require.Nil(t, e1.AddEdgeFromForeignKeyIndex("user_id", "contacts", "User"))

	s1 := &schema.Schema{
		Nodes: map[string]*schema.NodeDataInfo{
			"User": {
				NodeData: &schema.NodeData{
					NodeInfo:    nodeinfo.GetNodeInfo("user"),
					PackageName: "user",
					EdgeInfo:    e1,
				},
			},
		},
	}
	s2 := &schema.Schema{
		Nodes: map[string]*schema.NodeDataInfo{
			"User": {
				NodeData: &schema.NodeData{
					NodeInfo:    nodeinfo.GetNodeInfo("user"),
					PackageName: "user",
				},
			},
		},
	}
	m, err := schema.CompareSchemas(s1, s2)
	require.Nil(t, err)
	require.Len(t, m, 1)

	user := m["User"]
	require.Len(t, user, 2)
	verifyChange(t, change.Change{
		Change: change.RemoveEdge,
		Edge:   "contacts",
	}, user[0])
	verifyChange(t, change.Change{
		Change: change.ModifyNode,
		Node:   "User",
	}, user[1])
}

func TestForeignKeyEdgeModified(t *testing.T) {
	// only thing that can really change here is name so instead of modified_edge, we're just going to treat it like dropped edge, added edge
	e1 := edge.NewEdgeInfo("user")
	require.Nil(t, e1.AddEdgeFromForeignKeyIndex("user_id", "contacts", "User"))
	e2 := edge.NewEdgeInfo("user")
	require.Nil(t, e2.AddEdgeFromForeignKeyIndex("user_id", "user_contacts", "User"))

	s1 := &schema.Schema{
		Nodes: map[string]*schema.NodeDataInfo{
			"User": {
				NodeData: &schema.NodeData{
					NodeInfo:    nodeinfo.GetNodeInfo("user"),
					PackageName: "user",
					EdgeInfo:    e1,
				},
			},
		},
	}
	s2 := &schema.Schema{
		Nodes: map[string]*schema.NodeDataInfo{
			"User": {
				NodeData: &schema.NodeData{
					NodeInfo:    nodeinfo.GetNodeInfo("user"),
					PackageName: "user",
					EdgeInfo:    e2,
				},
			},
		},
	}
	m, err := schema.CompareSchemas(s1, s2)
	require.Nil(t, err)
	require.Len(t, m, 1)

	user := m["User"]
	require.Len(t, user, 3)
	verifyChange(t, change.Change{
		Change: change.RemoveEdge,
		Edge:   "contacts",
	}, user[0])
	verifyChange(t, change.Change{
		Change: change.AddEdge,
		Edge:   "user_contacts",
	}, user[1])
	verifyChange(t, change.Change{
		Change: change.ModifyNode,
		Node:   "User",
	}, user[2])
}

func TestIndexedEdgeNochange(t *testing.T) {
	e1 := edge.NewEdgeInfo("user")
	require.Nil(t, e1.AddIndexedEdgeFromSource("ownerID", "owner_id", "User", &base.PolymorphicOptions{
		PolymorphicOptions: &input.PolymorphicOptions{},
	}))

	e2 := edge.NewEdgeInfo("user")
	require.Nil(t, e2.AddIndexedEdgeFromSource("ownerID", "owner_id", "User", &base.PolymorphicOptions{
		PolymorphicOptions: &input.PolymorphicOptions{},
	}))

	s1 := &schema.Schema{
		Nodes: map[string]*schema.NodeDataInfo{
			"User": {
				NodeData: &schema.NodeData{
					NodeInfo:    nodeinfo.GetNodeInfo("user"),
					PackageName: "user",
					EdgeInfo:    e1,
				},
			},
		},
	}
	s2 := &schema.Schema{
		Nodes: map[string]*schema.NodeDataInfo{
			"User": {
				NodeData: &schema.NodeData{
					NodeInfo:    nodeinfo.GetNodeInfo("user"),
					PackageName: "user",
					EdgeInfo:    e2,
				},
			},
		},
	}
	m, err := schema.CompareSchemas(s1, s2)
	require.Nil(t, err)
	require.Len(t, m, 0)
}

func TestIndexedEdgeAdded(t *testing.T) {
	e2 := edge.NewEdgeInfo("user")
	require.Nil(t, e2.AddIndexedEdgeFromSource("ownerID", "owner_id", "User", &base.PolymorphicOptions{
		PolymorphicOptions: &input.PolymorphicOptions{},
	}))

	s1 := &schema.Schema{
		Nodes: map[string]*schema.NodeDataInfo{
			"User": {
				NodeData: &schema.NodeData{
					NodeInfo:    nodeinfo.GetNodeInfo("user"),
					PackageName: "user",
				},
			},
		},
	}
	s2 := &schema.Schema{
		Nodes: map[string]*schema.NodeDataInfo{
			"User": {
				NodeData: &schema.NodeData{
					NodeInfo:    nodeinfo.GetNodeInfo("user"),
					PackageName: "user",
					EdgeInfo:    e2,
				},
			},
		},
	}
	m, err := schema.CompareSchemas(s1, s2)
	require.Nil(t, err)
	require.Len(t, m, 1)

	user := m["User"]
	require.Len(t, user, 2)
	verifyChange(t, change.Change{
		Change: change.AddEdge,
		Edge:   "Users",
	}, user[0])
	verifyChange(t, change.Change{
		Change: change.ModifyNode,
		Node:   "User",
	}, user[1])
}

func TestIndexedEdgeRemoved(t *testing.T) {
	e1 := edge.NewEdgeInfo("user")
	require.Nil(t, e1.AddIndexedEdgeFromSource("ownerID", "owner_id", "User", &base.PolymorphicOptions{
		PolymorphicOptions: &input.PolymorphicOptions{},
	}))

	s1 := &schema.Schema{
		Nodes: map[string]*schema.NodeDataInfo{
			"User": {
				NodeData: &schema.NodeData{
					NodeInfo:    nodeinfo.GetNodeInfo("user"),
					PackageName: "user",
					EdgeInfo:    e1,
				},
			},
		},
	}
	s2 := &schema.Schema{
		Nodes: map[string]*schema.NodeDataInfo{
			"User": {
				NodeData: &schema.NodeData{
					NodeInfo:    nodeinfo.GetNodeInfo("user"),
					PackageName: "user",
				},
			},
		},
	}
	m, err := schema.CompareSchemas(s1, s2)
	require.Nil(t, err)
	require.Len(t, m, 1)

	user := m["User"]
	require.Len(t, user, 2)
	verifyChange(t, change.Change{
		Change: change.RemoveEdge,
		Edge:   "Users",
	}, user[0])
	verifyChange(t, change.Change{
		Change: change.ModifyNode,
		Node:   "User",
	}, user[1])
}

func TestIndexedEdgeModified(t *testing.T) {
	e1 := edge.NewEdgeInfo("user")
	require.Nil(t, e1.AddIndexedEdgeFromSource("owner_id", "owner_id", "User", &base.PolymorphicOptions{
		PolymorphicOptions: &input.PolymorphicOptions{},
	}))
	// change field name, keep col name
	e2 := edge.NewEdgeInfo("user")
	require.Nil(t, e2.AddIndexedEdgeFromSource("ownerID", "owner_id", "User", &base.PolymorphicOptions{
		PolymorphicOptions: &input.PolymorphicOptions{},
	}))

	s1 := &schema.Schema{
		Nodes: map[string]*schema.NodeDataInfo{
			"User": {
				NodeData: &schema.NodeData{
					NodeInfo:    nodeinfo.GetNodeInfo("user"),
					PackageName: "user",
					EdgeInfo:    e1,
				},
			},
		},
	}
	s2 := &schema.Schema{
		Nodes: map[string]*schema.NodeDataInfo{
			"User": {
				NodeData: &schema.NodeData{
					NodeInfo:    nodeinfo.GetNodeInfo("user"),
					PackageName: "user",
					EdgeInfo:    e2,
				},
			},
		},
	}
	m, err := schema.CompareSchemas(s1, s2)
	require.Nil(t, err)
	require.Len(t, m, 1)

	user := m["User"]
	require.Len(t, user, 2)
	verifyChange(t, change.Change{
		Change: change.ModifyEdge,
		Edge:   "Users",
	}, user[0])
	verifyChange(t, change.Change{
		Change: change.ModifyNode,
		Node:   "User",
	}, user[1])
}

func createDuplicateAssocEdgeFromInput(t *testing.T, packageName string, inputEdge *input.AssocEdge) (*edge.AssociationEdge, *edge.AssociationEdge) {
	edge1, err := edge.AssocEdgeFromInput(packageName, inputEdge)
	require.Nil(t, err)
	inputEdge2 := marshallAndUnmarshallInputAssocEdge(t, inputEdge)
	edge2, err := edge.AssocEdgeFromInput(packageName, inputEdge2)
	require.Nil(t, err)

	return edge1, edge2
}

func marshallAndUnmarshallInputAssocEdge(t *testing.T, inputEdge *input.AssocEdge) *input.AssocEdge {
	b, err := json.Marshal(inputEdge)
	require.Nil(t, err)
	edge2 := &input.AssocEdge{}
	err = json.Unmarshal(b, edge2)
	require.Nil(t, err)
	return edge2
}

func createActionInfoFromInput(t *testing.T, nodeName string, node *input.Node) *action.ActionInfo {
	ai, err := action.ParseFromInputNode(nodeName, node, base.TypeScript)
	require.Nil(t, err)
	return ai
}

func verifyChange(t *testing.T, expChange, change change.Change) {
	assert.Equal(t, expChange.Change, change.Change)
	assert.Equal(t, expChange.Field, change.Field)
	assert.Equal(t, expChange.Edge, change.Edge)
	assert.Equal(t, expChange.EdgeGroup, change.EdgeGroup)
	assert.Equal(t, expChange.Pattern, change.Pattern)
	assert.Equal(t, expChange.Node, change.Node)
	assert.Equal(t, expChange.Action, change.Action)
	assert.Equal(t, expChange.Enum, change.Enum)
	assert.Equal(t, expChange.GraphQLOnly, change.GraphQLOnly)
	assert.Equal(t, expChange.TSOnly, change.TSOnly)
}
