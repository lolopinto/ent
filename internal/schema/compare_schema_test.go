package schema_test

import (
	"encoding/json"
	"testing"

	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/internal/action"
	"github.com/lolopinto/ent/internal/codegen/codegenapi"
	"github.com/lolopinto/ent/internal/codegen/nodeinfo"
	"github.com/lolopinto/ent/internal/edge"
	"github.com/lolopinto/ent/internal/field"
	"github.com/lolopinto/ent/internal/schema"
	"github.com/lolopinto/ent/internal/schema/base"
	"github.com/lolopinto/ent/internal/schema/change"
	"github.com/lolopinto/ent/internal/schema/enum"
	"github.com/lolopinto/ent/internal/schema/input"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newFieldInfoTests(t *testing.T, fields []*input.Field) *field.FieldInfo {
	fi, err := field.NewFieldInfoFromInputs(
		&codegenapi.DummyConfig{},
		"User",
		fields,
		&field.Options{})
	require.Nil(t, err)
	return fi
}

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
		Change: change.AddPattern,
		Name:   "node",
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
		Change: change.RemovePattern,
		Name:   "node",
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
	edge1, err := edge.AssocEdgeFromInput(
		&codegenapi.DummyConfig{},
		"user",
		&input.AssocEdge{
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
		Change:      change.AddEdge,
		Name:        "likes",
		GraphQLName: "UserToLikesConnection",
		ExtraInfo:   "UserToLikesQuery",
	}, feedback[0])
}

func TestComparePatternsWithRemovedEdge(t *testing.T) {
	edge1, err := edge.AssocEdgeFromInput(
		&codegenapi.DummyConfig{},
		"user",
		&input.AssocEdge{
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
		Change:      change.RemoveEdge,
		Name:        "likes",
		GraphQLName: "UserToLikesConnection",
		ExtraInfo:   "UserToLikesQuery",
	}, feedback[0])
}

func TestComparePatternsWithModifiedEdge(t *testing.T) {
	edge1, err := edge.AssocEdgeFromInput(
		&codegenapi.DummyConfig{},
		"user", &input.AssocEdge{
			Name:       "Likes",
			SchemaName: "User",
		})
	require.Nil(t, err)
	edge2, err := edge.AssocEdgeFromInput(
		&codegenapi.DummyConfig{},
		"user",
		&input.AssocEdge{
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
		Change:      change.ModifyEdge,
		Name:        "likes",
		GraphQLName: "UserToLikesConnection",
		ExtraInfo:   "UserToLikesQuery",
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
		Change:      change.AddNode,
		Name:        "User",
		GraphQLName: "User",
	}, user[0])
}

func TestCompareAddNodeTableNameSet(t *testing.T) {
	s1 := &schema.Schema{}
	s2 := &schema.Schema{
		Nodes: map[string]*schema.NodeDataInfo{
			"User": {
				NodeData: &schema.NodeData{
					NodeInfo:    nodeinfo.GetNodeInfo("user"),
					PackageName: "user",
					TableName:   "users",
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
		Change:      change.AddNode,
		Name:        "User",
		GraphQLName: "User",
	}, user[0])
}

func TestCompareAddEnumTableNode(t *testing.T) {
	s2 := &schema.Schema{
		Nodes: map[string]*schema.NodeDataInfo{
			"Role": {
				NodeData: &schema.NodeData{
					NodeInfo:    nodeinfo.GetNodeInfo("role"),
					PackageName: "role",
					EnumTable:   true,
					DBRows: []map[string]interface{}{
						{
							"role": "admin",
						},
						{
							"role": "member",
						},
					},
				},
			},
		},
	}
	s1 := &schema.Schema{}

	m, err := schema.CompareSchemas(s1, s2)
	require.Nil(t, err)
	require.Len(t, m, 1)
	role := m["Role"]
	require.Len(t, role, 1)
	verifyChange(t, change.Change{
		Change:      change.AddNode,
		Name:        "Role",
		GraphQLName: "Role",
	}, role[0])
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
		Change:      change.RemoveNode,
		Name:        "User",
		GraphQLName: "User",
	}, user[0])
}

func TestCompareRemoveNodeTableNameSet(t *testing.T) {
	s1 := &schema.Schema{
		Nodes: map[string]*schema.NodeDataInfo{
			"User": {
				NodeData: &schema.NodeData{
					NodeInfo:    nodeinfo.GetNodeInfo("user"),
					PackageName: "user",
					TableName:   "users",
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
		Change:      change.RemoveNode,
		Name:        "User",
		GraphQLName: "User",
	}, user[0])
}

func TestCompareRemoveEnumTableNode(t *testing.T) {
	s1 := &schema.Schema{
		Nodes: map[string]*schema.NodeDataInfo{
			"Role": {
				NodeData: &schema.NodeData{
					NodeInfo:    nodeinfo.GetNodeInfo("role"),
					PackageName: "role",
					EnumTable:   true,
					DBRows: []map[string]interface{}{
						{
							"role": "admin",
						},
						{
							"role": "member",
						},
					},
				},
			},
		},
	}
	s2 := &schema.Schema{}

	m, err := schema.CompareSchemas(s1, s2)
	require.Nil(t, err)
	require.Len(t, m, 1)
	role := m["Role"]
	require.Len(t, role, 1)
	verifyChange(t, change.Change{
		Change:      change.RemoveNode,
		Name:        "Role",
		GraphQLName: "Role",
	}, role[0])
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
	fi := newFieldInfoTests(
		t,
		[]*input.Field{
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
		})
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
	if user[0].Name == "first_name" {
		firstIdx = 0
		lastIdx = 1
	} else {
		firstIdx = 1
		lastIdx = 0
	}
	verifyChange(t, change.Change{
		Change: change.AddField,
		Name:   "first_name",
	}, user[firstIdx])
	verifyChange(t, change.Change{
		Change: change.AddField,
		Name:   "last_name",
	}, user[lastIdx])
	verifyChange(t, change.Change{
		Change:      change.ModifyNode,
		Name:        "User",
		GraphQLName: "User",
	}, user[2])
}

func TestCompareNodesRemoveField(t *testing.T) {
	fi1 := newFieldInfoTests(
		t,
		[]*input.Field{
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
		})
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

	fi2 := newFieldInfoTests(
		t,
		[]*input.Field{
			{
				Name: "first_name",
				Type: &input.FieldType{
					DBType: input.String,
				},
			},
		})
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
		Name:   "last_name",
	}, user[0])
	verifyChange(t, change.Change{
		Change:      change.ModifyNode,
		Name:        "User",
		GraphQLName: "User",
	}, user[1])
}

func TestCompareNodesModifyField(t *testing.T) {
	fi1 := newFieldInfoTests(
		t,
		[]*input.Field{
			{
				Name: "first_name",
				Type: &input.FieldType{
					DBType: input.String,
				},
			},
		})
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

	fi2 := newFieldInfoTests(
		t,
		[]*input.Field{
			{
				Name: "first_name",
				Type: &input.FieldType{
					DBType: input.String,
				},
				Nullable: true,
			},
		})
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
		Name:   "first_name",
	}, user[0])
	verifyChange(t, change.Change{
		Change:      change.ModifyNode,
		Name:        "User",
		GraphQLName: "User",
	}, user[1])
}

func TestCompareNodesModifyDBType(t *testing.T) {
	fi1 := newFieldInfoTests(
		t,
		[]*input.Field{
			{
				Name: "first_name",
				Type: &input.FieldType{
					DBType: input.String,
				},
			},
		})
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

	fi2 := newFieldInfoTests(
		t,
		[]*input.Field{
			{
				Name: "first_name",
				Type: &input.FieldType{
					DBType: input.JSONB,
				},
			},
		})
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
	require.Nil(t, m)
	require.Error(t, err)
}

func TestCompareNodesChangeFieldKeepDBKey(t *testing.T) {
	fi1 := newFieldInfoTests(
		t,
		[]*input.Field{
			{
				Name: "first_name",
				Type: &input.FieldType{
					DBType: input.String,
				},
			},
		})
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

	fi2 := newFieldInfoTests(
		t,
		[]*input.Field{
			{
				Name: "firstName",
				Type: &input.FieldType{
					DBType: input.String,
				},
			},
		})
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
		Name:   "firstName",
	}, user[0])
	verifyChange(t, change.Change{
		Change:      change.ModifyNode,
		Name:        "User",
		GraphQLName: "User",
	}, user[1])
}

func TestCompareNodesWithEdgesNoChange(t *testing.T) {
	e1, err := edge.EdgeInfoFromInput(
		&codegenapi.DummyConfig{},
		"user", &input.Node{
			AssocEdges: []*input.AssocEdge{
				{
					Name:       "Likes",
					SchemaName: "User",
				},
			},
		})
	require.Nil(t, err)
	e2, err := edge.EdgeInfoFromInput(
		&codegenapi.DummyConfig{},
		"user", &input.Node{
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
	e2, err := edge.EdgeInfoFromInput(
		&codegenapi.DummyConfig{},
		"user", &input.Node{
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
		Change:      change.AddEdge,
		Name:        "Likes",
		GraphQLName: "UserToLikesConnection",
		ExtraInfo:   "UserToLikesQuery",
	}, user[0])
	verifyChange(t, change.Change{
		Change:      change.ModifyNode,
		Name:        "User",
		GraphQLName: "User",
	}, user[1])
}

func TestCompareNodesWithRemovedEdge(t *testing.T) {
	e1, err := edge.EdgeInfoFromInput(
		&codegenapi.DummyConfig{},
		"user", &input.Node{
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
		Change:      change.RemoveEdge,
		Name:        "Likes",
		GraphQLName: "UserToLikesConnection",
		ExtraInfo:   "UserToLikesQuery",
	}, user[0])
	verifyChange(t, change.Change{
		Change:      change.ModifyNode,
		Name:        "User",
		GraphQLName: "User",
	}, user[1])
}

func TestCompareNodesWithModifiedEdge(t *testing.T) {
	e1, err := edge.EdgeInfoFromInput(
		&codegenapi.DummyConfig{},
		"user", &input.Node{
			AssocEdges: []*input.AssocEdge{
				{
					Name:       "Likes",
					SchemaName: "User",
				},
			},
		})
	require.Nil(t, err)
	e2, err := edge.EdgeInfoFromInput(
		&codegenapi.DummyConfig{},
		"user", &input.Node{
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
		Change:      change.ModifyEdge,
		Name:        "Likes",
		GraphQLName: "UserToLikesConnection",
		ExtraInfo:   "UserToLikesQuery",
	}, user[0])
	verifyChange(t, change.Change{
		Change:      change.ModifyNode,
		Name:        "User",
		GraphQLName: "User",
	}, user[1])
}

func TestCompareNodesWithRenamedEdge(t *testing.T) {
	e1, err := edge.EdgeInfoFromInput(
		&codegenapi.DummyConfig{},
		"user",
		&input.Node{
			AssocEdges: []*input.AssocEdge{
				{
					Name:       "Likes",
					SchemaName: "User",
				},
			},
		})
	require.Nil(t, err)
	e2, err := edge.EdgeInfoFromInput(
		&codegenapi.DummyConfig{},
		"user",
		&input.Node{
			AssocEdges: []*input.AssocEdge{
				{
					Name:       "LikedPeople",
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
	require.Len(t, m, 1)

	user := m["User"]
	require.Len(t, user, 3)
	verifyChange(t, change.Change{
		Change:      change.RemoveEdge,
		Name:        "Likes",
		GraphQLName: "UserToLikesConnection",
		ExtraInfo:   "UserToLikesQuery",
	}, user[0])
	verifyChange(t, change.Change{
		Change:      change.AddEdge,
		Name:        "LikedPeople",
		GraphQLName: "UserToLikedPeopleConnection",
		ExtraInfo:   "UserToLikedPeopleQuery",
	}, user[1])
	verifyChange(t, change.Change{
		Change:      change.ModifyNode,
		Name:        "User",
		GraphQLName: "User",
	}, user[2])
}

func TestCompareNodesWithEdgeGroupNoChange(t *testing.T) {
	e1, err := edge.EdgeInfoFromInput(
		&codegenapi.DummyConfig{},
		"user",
		&input.Node{
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
	e2, err := edge.EdgeInfoFromInput(
		&codegenapi.DummyConfig{},
		"user", &input.Node{
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
	e2, err := edge.EdgeInfoFromInput(
		&codegenapi.DummyConfig{},
		"user",
		&input.Node{
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
		Change: change.AddEdgeGroup,
		Name:   "FriendshipStatus",
	}, user[2])
	verifyChange(t, change.Change{
		Change:      change.ModifyNode,
		Name:        "User",
		GraphQLName: "User",
	}, user[3])
}

func TestCompareNodesWithEdgeGroupRemoved(t *testing.T) {
	e1, err := edge.EdgeInfoFromInput(
		&codegenapi.DummyConfig{},
		"user",
		&input.Node{
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
		Change: change.RemoveEdgeGroup,
		Name:   "FriendshipStatus",
	}, user[2])
	verifyChange(t, change.Change{
		Change:      change.ModifyNode,
		Name:        "User",
		GraphQLName: "User",
	}, user[3])
}

func TestCompareNodesWithEdgeGroupModified(t *testing.T) {
	e1, err := edge.EdgeInfoFromInput(
		&codegenapi.DummyConfig{},
		"user",
		&input.Node{
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
	e2, err := edge.EdgeInfoFromInput(
		&codegenapi.DummyConfig{},
		"user",
		&input.Node{
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
		Change: change.ModifyEdgeGroup,
		Name:   "FriendshipStatus",
	}, user[0])
	verifyChange(t, change.Change{
		Change:      change.ModifyNode,
		Name:        "User",
		GraphQLName: "User",
	}, user[1])
}

func TestCompareNodesWithEdgeGroupRenamed(t *testing.T) {
	e1, err := edge.EdgeInfoFromInput(
		&codegenapi.DummyConfig{},
		"user",
		&input.Node{
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
	e2, err := edge.EdgeInfoFromInput(
		&codegenapi.DummyConfig{},
		"user",
		&input.Node{
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
	var friendsIdx, friendsRequestSentIdx int
	if user[0].Name == "Friends" {
		friendsIdx = 0
		friendsRequestSentIdx = 1
	} else {
		friendsIdx = 1
		friendsRequestSentIdx = 0
	}
	// table name changed since part of new group and table name not overriden
	verifyChange(t, change.Change{
		Change:      change.ModifyEdge,
		Name:        "Friends",
		GraphQLName: "UserToFriendsConnection",
		ExtraInfo:   "UserToFriendsQuery",
	}, user[friendsIdx])
	verifyChange(t, change.Change{
		Change:      change.ModifyEdge,
		Name:        "FriendRequestsSent",
		GraphQLName: "UserToFriendRequestsSentConnection",
		ExtraInfo:   "UserToFriendRequestsSentQuery",
	}, user[friendsRequestSentIdx])
	verifyChange(t, change.Change{
		Change:      change.AddEdge,
		Name:        "Following",
		GraphQLName: "UserToFollowingConnection",
		ExtraInfo:   "UserToFollowingQuery",
	}, user[2])
	verifyChange(t, change.Change{
		Change: change.RemoveEdgeGroup,
		Name:   "FriendshipStatus",
	}, user[3])
	verifyChange(t, change.Change{
		Change: change.AddEdgeGroup,
		Name:   "ConnectionStatus",
	}, user[4])
	verifyChange(t, change.Change{
		Change:      change.ModifyNode,
		Name:        "User",
		GraphQLName: "User",
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
		Change:      change.AddAction,
		Name:        "CreateUserAction",
		GraphQLName: "userCreate",
	}, user[0])
	verifyChange(t, change.Change{
		Change:      change.ModifyNode,
		Name:        "User",
		GraphQLName: "User",
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
		Change:      change.RemoveAction,
		Name:        "CreateUserAction",
		GraphQLName: "userCreate",
	}, user[0])
	verifyChange(t, change.Change{
		Change:      change.ModifyNode,
		Name:        "User",
		GraphQLName: "User",
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
		Change:      change.ModifyAction,
		Name:        "CreateUserAction",
		GraphQLName: "userCreate",
	}, user[0])
	verifyChange(t, change.Change{
		Change:      change.ModifyNode,
		Name:        "User",
		GraphQLName: "User",
	}, user[1])
}

func TestCompareActionsGraphQLNameModified(t *testing.T) {
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
				Operation:         ent.CreateAction,
				CustomGraphQLName: "userCreate",
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
				Operation:         ent.CreateAction,
				CustomGraphQLName: "createUser",
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
	require.Len(t, user, 4)
	verifyChange(t, change.Change{
		Change:      change.ModifyAction,
		Name:        "CreateUserAction",
		GraphQLName: "userCreate",
		TSOnly:      true,
	}, user[0])
	verifyChange(t, change.Change{
		Change:      change.RemoveAction,
		Name:        "CreateUserAction",
		GraphQLName: "userCreate",
		GraphQLOnly: true,
	}, user[1])
	verifyChange(t, change.Change{
		Change:      change.AddAction,
		Name:        "CreateUserAction",
		GraphQLName: "createUser",
		GraphQLOnly: true,
	}, user[2])
	verifyChange(t, change.Change{
		Change:      change.ModifyNode,
		Name:        "User",
		GraphQLName: "User",
	}, user[3])
}

func TestForeignKeyEdgeNoChange(t *testing.T) {
	e1 := edge.NewEdgeInfo("user")
	require.Nil(t, e1.AddEdgeFromForeignKeyIndex(
		&codegenapi.DummyConfig{},
		"user_id",
		"contacts",
		"User",
	))

	e2 := edge.NewEdgeInfo("user")
	require.Nil(t, e2.AddEdgeFromForeignKeyIndex(&codegenapi.DummyConfig{},
		"user_id",
		"contacts",
		"User"))

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
	require.Nil(t, e2.AddEdgeFromForeignKeyIndex(
		&codegenapi.DummyConfig{},
		"user_id", "contacts", "User"))

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
		Change:      change.AddEdge,
		Name:        "contacts",
		GraphQLName: "UserToContactsConnection",
		ExtraInfo:   "UserToContactsQuery",
	}, user[0])
	verifyChange(t, change.Change{
		Change:      change.ModifyNode,
		Name:        "User",
		GraphQLName: "User",
	}, user[1])
}

func TestForeignKeyEdgeRemoved(t *testing.T) {
	e1 := edge.NewEdgeInfo("user")
	require.Nil(t, e1.AddEdgeFromForeignKeyIndex(
		&codegenapi.DummyConfig{},
		"user_id", "contacts", "User"))

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
		Change:      change.RemoveEdge,
		Name:        "contacts",
		GraphQLName: "UserToContactsConnection",
		ExtraInfo:   "UserToContactsQuery",
	}, user[0])
	verifyChange(t, change.Change{
		Change:      change.ModifyNode,
		Name:        "User",
		GraphQLName: "User",
	}, user[1])
}

func TestForeignKeyEdgeModified(t *testing.T) {
	// only thing that can really change here is name so instead of modified_edge, we're just going to treat it like dropped edge, added edge
	e1 := edge.NewEdgeInfo("user")
	require.Nil(t, e1.AddEdgeFromForeignKeyIndex(&codegenapi.DummyConfig{},
		"user_id",
		"contacts",
		"User"))
	e2 := edge.NewEdgeInfo("user")
	require.Nil(t, e2.AddEdgeFromForeignKeyIndex(
		&codegenapi.DummyConfig{},
		"user_id",
		"user_contacts",
		"User"))

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
		Change:      change.RemoveEdge,
		Name:        "contacts",
		GraphQLName: "UserToContactsConnection",
		ExtraInfo:   "UserToContactsQuery",
	}, user[0])
	verifyChange(t, change.Change{
		Change:      change.AddEdge,
		Name:        "user_contacts",
		GraphQLName: "UserToUserContactsConnection",
		ExtraInfo:   "UserToUserContactsQuery",
	}, user[1])
	verifyChange(t, change.Change{
		Change:      change.ModifyNode,
		Name:        "User",
		GraphQLName: "User",
	}, user[2])
}

func TestIndexedEdgeNochange(t *testing.T) {
	e1 := edge.NewEdgeInfo("user")
	require.Nil(t, e1.AddIndexedEdgeFromSource(
		&codegenapi.DummyConfig{},
		"ownerID",
		"owner_id",
		"User",
		&base.PolymorphicOptions{
			PolymorphicOptions: &input.PolymorphicOptions{},
		}))

	e2 := edge.NewEdgeInfo("user")
	require.Nil(t, e2.AddIndexedEdgeFromSource(
		&codegenapi.DummyConfig{},
		"ownerID",
		"owner_id",
		"User",
		&base.PolymorphicOptions{
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

// TODO testindexeEdge which is not polymorphic...
func TestIndexedEdgeAdded(t *testing.T) {
	e2 := edge.NewEdgeInfo("user")
	require.Nil(t, e2.AddIndexedEdgeFromSource(
		&codegenapi.DummyConfig{},
		"ownerID",
		"owner_id",
		"User",
		&base.PolymorphicOptions{
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
		Name:   "ownerIDS",
		// no connection...
		GraphQLName: "",
		ExtraInfo:   "OwnerToUsersQuery",
	}, user[0])
	verifyChange(t, change.Change{
		Change:      change.ModifyNode,
		Name:        "User",
		GraphQLName: "User",
	}, user[1])
}

func TestIndexedEdgeRemoved(t *testing.T) {
	e1 := edge.NewEdgeInfo("user")
	require.Nil(t, e1.AddIndexedEdgeFromSource(
		&codegenapi.DummyConfig{},
		"ownerID",
		"owner_id",
		"User",
		&base.PolymorphicOptions{
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
		Name:   "ownerIDS",
		// no connection...
		GraphQLName: "",
		ExtraInfo:   "OwnerToUsersQuery",
	}, user[0])
	verifyChange(t, change.Change{
		Change:      change.ModifyNode,
		Name:        "User",
		GraphQLName: "User",
	}, user[1])
}

func TestIndexedEdgeModified(t *testing.T) {
	e1 := edge.NewEdgeInfo("user")
	require.Nil(t, e1.AddIndexedEdgeFromSource(
		&codegenapi.DummyConfig{},
		"owner_id",
		"owner_id",
		"User",
		&base.PolymorphicOptions{
			PolymorphicOptions: &input.PolymorphicOptions{},
		}))
	// change polymorphic flag
	e2 := edge.NewEdgeInfo("user")
	require.Nil(t, e2.AddIndexedEdgeFromSource(
		&codegenapi.DummyConfig{},
		"owner_id",
		"owner_id",
		"User",
		&base.PolymorphicOptions{
			PolymorphicOptions: &input.PolymorphicOptions{
				HideFromInverseGraphQL: true,
			},
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
		Name:   "owner_ids",
		// no connection
		GraphQLName: "",
		ExtraInfo:   "OwnerIdToUsersQuery",
	}, user[0])
	verifyChange(t, change.Change{
		Change:      change.ModifyNode,
		Name:        "User",
		GraphQLName: "User",
	}, user[1])
}

func TestEnumNoChange(t *testing.T) {
	s1 := &schema.Schema{
		Enums: map[string]*schema.EnumInfo{
			"Language": getEnumInfo(nil),
		},
	}
	s2 := &schema.Schema{
		Enums: map[string]*schema.EnumInfo{
			"Language": getEnumInfo(nil),
		},
	}
	m, err := schema.CompareSchemas(s1, s2)
	require.Nil(t, err)
	require.Len(t, m, 0)
}

func TestEnumNoChangeNoGQL(t *testing.T) {
	s1 := &schema.Schema{
		Enums: map[string]*schema.EnumInfo{
			"Language": getEnumInfoNoGQL(nil),
		},
	}
	s2 := &schema.Schema{
		Enums: map[string]*schema.EnumInfo{
			"Language": getEnumInfoNoGQL(nil),
		},
	}
	m, err := schema.CompareSchemas(s1, s2)
	require.Nil(t, err)
	require.Len(t, m, 0)
}

func TestEnumAdded(t *testing.T) {
	s1 := &schema.Schema{}
	s2 := &schema.Schema{
		Enums: map[string]*schema.EnumInfo{
			"Language": getEnumInfo(nil),
		},
	}
	m, err := schema.CompareSchemas(s1, s2)
	require.Nil(t, err)
	require.Len(t, m, 1)

	lang := m["Language"]
	require.Len(t, lang, 1)
	verifyChange(t, change.Change{
		Change:      change.AddEnum,
		Name:        "Language",
		GraphQLName: "Language",
	}, lang[0])
}

func TestEnumAddedNoGQL(t *testing.T) {
	s1 := &schema.Schema{}
	s2 := &schema.Schema{
		Enums: map[string]*schema.EnumInfo{
			"Language": getEnumInfoNoGQL(nil),
		},
	}
	m, err := schema.CompareSchemas(s1, s2)
	require.Nil(t, err)
	require.Len(t, m, 1)

	lang := m["Language"]
	require.Len(t, lang, 1)
	verifyChange(t, change.Change{
		Change: change.AddEnum,
		Name:   "Language",
		TSOnly: true,
	}, lang[0])
}

func TestEnumRemoved(t *testing.T) {
	s1 := &schema.Schema{
		Enums: map[string]*schema.EnumInfo{
			"Language": getEnumInfo(nil),
		},
	}
	s2 := &schema.Schema{}
	m, err := schema.CompareSchemas(s1, s2)
	require.Nil(t, err)
	require.Len(t, m, 1)

	lang := m["Language"]
	require.Len(t, lang, 1)
	verifyChange(t, change.Change{
		Change:      change.RemoveEnum,
		Name:        "Language",
		GraphQLName: "Language",
	}, lang[0])
}

func TestEnumRemovedNoGQL(t *testing.T) {
	s1 := &schema.Schema{
		Enums: map[string]*schema.EnumInfo{
			"Language": getEnumInfoNoGQL(nil),
		},
	}
	s2 := &schema.Schema{}
	m, err := schema.CompareSchemas(s1, s2)
	require.Nil(t, err)
	require.Len(t, m, 1)

	lang := m["Language"]
	require.Len(t, lang, 1)
	verifyChange(t, change.Change{
		Change: change.RemoveEnum,
		Name:   "Language",
		TSOnly: true,
	}, lang[0])
}

func TestEnumModified(t *testing.T) {
	s1 := &schema.Schema{
		Enums: map[string]*schema.EnumInfo{
			"Language": getEnumInfo(nil),
		},
	}

	s2 := &schema.Schema{
		Enums: map[string]*schema.EnumInfo{
			"Language": getEnumInfo(
				map[string]string{
					"Java":       "java",
					"CPlusPlus":  "c++",
					"CSharp":     "c#",
					"JavaScript": "js",
					"TypeScript": "ts",
					"GoLang":     "go",
					"Python":     "python",
					"Rust":       "rust",
				}),
		},
	}
	m, err := schema.CompareSchemas(s1, s2)
	require.Nil(t, err)
	require.Len(t, m, 1)

	lang := m["Language"]
	require.Len(t, lang, 1)
	verifyChange(t, change.Change{
		Change:      change.ModifyEnum,
		Name:        "Language",
		GraphQLName: "Language",
	}, lang[0])
}

func TestEnumModifiedNoGQL(t *testing.T) {
	s1 := &schema.Schema{
		Enums: map[string]*schema.EnumInfo{
			"Language": getEnumInfoNoGQL(nil),
		},
	}

	s2 := &schema.Schema{
		Enums: map[string]*schema.EnumInfo{
			"Language": getEnumInfoNoGQL(
				map[string]string{
					"Java":       "java",
					"CPlusPlus":  "c++",
					"CSharp":     "c#",
					"JavaScript": "js",
					"TypeScript": "ts",
					"GoLang":     "go",
					"Python":     "python",
					"Rust":       "rust",
				}),
		},
	}
	m, err := schema.CompareSchemas(s1, s2)
	require.Nil(t, err)
	require.Len(t, m, 1)

	lang := m["Language"]
	require.Len(t, lang, 1)
	verifyChange(t, change.Change{
		Change: change.ModifyEnum,
		Name:   "Language",
		TSOnly: true,
	}, lang[0])
}

func TestEnumGQLNameChange(t *testing.T) {
	s1 := &schema.Schema{
		Enums: map[string]*schema.EnumInfo{
			"Language": getEnumInfo(nil),
		},
	}
	e2 := getEnumInfo(nil)
	e2.GQLEnum.Name = "GraphQLLanguage"
	s2 := &schema.Schema{
		Enums: map[string]*schema.EnumInfo{
			"Language": e2,
		},
	}
	m, err := schema.CompareSchemas(s1, s2)
	require.Nil(t, err)
	require.Len(t, m, 1)

	lang := m["Language"]
	require.Len(t, lang, 3)
	verifyChange(t, change.Change{
		Change:      change.ModifyEnum,
		Name:        "Language",
		GraphQLName: "Language",
		TSOnly:      true,
	}, lang[0])
	verifyChange(t, change.Change{
		Change:      change.RemoveEnum,
		Name:        "Language",
		GraphQLName: "Language",
		GraphQLOnly: true,
	}, lang[1])
	verifyChange(t, change.Change{
		Change:      change.AddEnum,
		Name:        "Language",
		GraphQLName: "GraphQLLanguage",
		GraphQLOnly: true,
	}, lang[2])
}

func TestEnumTSNameChange(t *testing.T) {
	s1 := &schema.Schema{
		Enums: map[string]*schema.EnumInfo{
			"Language": getEnumInfo(nil),
		},
	}
	e2 := getEnumInfo(nil)
	e2.Enum.Name = "TSLanguage"
	s2 := &schema.Schema{
		Enums: map[string]*schema.EnumInfo{
			"Language": e2,
		},
	}
	m, err := schema.CompareSchemas(s1, s2)
	require.Nil(t, err)
	require.Len(t, m, 1)

	lang := m["Language"]
	require.Len(t, lang, 3)
	verifyChange(t, change.Change{
		Change:      change.ModifyEnum,
		Name:        "Language",
		GraphQLName: "Language",
		GraphQLOnly: true,
	}, lang[0])
	verifyChange(t, change.Change{
		Change:      change.RemoveEnum,
		Name:        "Language",
		GraphQLName: "Language",
		TSOnly:      true,
	}, lang[1])
	verifyChange(t, change.Change{
		Change:      change.AddEnum,
		Name:        "TSLanguage",
		GraphQLName: "Language",
		TSOnly:      true,
	}, lang[2])
}

func TestEnumTSNameChangeNoGQL(t *testing.T) {
	s1 := &schema.Schema{
		Enums: map[string]*schema.EnumInfo{
			"Language": getEnumInfoNoGQL(nil),
		},
	}
	e2 := getEnumInfoNoGQL(nil)
	e2.Enum.Name = "TSLanguage"
	s2 := &schema.Schema{
		Enums: map[string]*schema.EnumInfo{
			"Language": e2,
		},
	}
	m, err := schema.CompareSchemas(s1, s2)
	require.Nil(t, err)
	require.Len(t, m, 1)

	lang := m["Language"]
	require.Len(t, lang, 2)
	verifyChange(t, change.Change{
		Change: change.RemoveEnum,
		Name:   "Language",
		TSOnly: true,
	}, lang[0])
	verifyChange(t, change.Change{
		Change: change.AddEnum,
		Name:   "TSLanguage",
		TSOnly: true,
	}, lang[1])
}

func TestCompareSchemaNewNodePlusActionsAndFields(t *testing.T) {
	fi := newFieldInfoTests(
		t,
		[]*input.Field{
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
		})

	e2, err := edge.EdgeInfoFromInput(
		&codegenapi.DummyConfig{},
		"user", &input.Node{
			AssocEdges: []*input.AssocEdge{
				{
					Name:       "Likes",
					SchemaName: "User",
				},
			},
		})
	require.Nil(t, err)
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

	s1 := &schema.Schema{}
	s2 := &schema.Schema{
		Nodes: map[string]*schema.NodeDataInfo{
			"User": {
				NodeData: &schema.NodeData{
					NodeInfo:    nodeinfo.GetNodeInfo("user"),
					PackageName: "user",
					FieldInfo:   fi,
					EdgeInfo:    e2,
					ActionInfo:  a2,
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
		Change:      change.AddNode,
		Name:        "User",
		GraphQLName: "User",
	}, user[0])
	verifyChange(t, change.Change{
		Change:      change.AddEdge,
		Name:        "Likes",
		GraphQLName: "UserToLikesConnection",
		ExtraInfo:   "UserToLikesQuery",
	}, user[1])
	verifyChange(t, change.Change{
		Change:      change.AddAction,
		Name:        "CreateUserAction",
		GraphQLName: "userCreate",
	}, user[2])
}

func TestCompareSchemaRemoveNodePlusActionsAndFields(t *testing.T) {
	fi := newFieldInfoTests(
		t,
		[]*input.Field{
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
		})

	e1, err := edge.EdgeInfoFromInput(
		&codegenapi.DummyConfig{},
		"user",
		&input.Node{
			AssocEdges: []*input.AssocEdge{
				{
					Name:       "Likes",
					SchemaName: "User",
				},
			},
		})
	require.Nil(t, err)
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
					FieldInfo:   fi,
					EdgeInfo:    e1,
					ActionInfo:  a1,
				},
			},
		},
	}
	s2 := &schema.Schema{}

	m, err := schema.CompareSchemas(s1, s2)
	require.Nil(t, err)
	require.Len(t, m, 1)
	user := m["User"]
	require.Len(t, user, 3)
	verifyChange(t, change.Change{
		Change:      change.RemoveNode,
		Name:        "User",
		GraphQLName: "User",
	}, user[0])
	verifyChange(t, change.Change{
		Change:      change.RemoveEdge,
		Name:        "Likes",
		GraphQLName: "UserToLikesConnection",
		ExtraInfo:   "UserToLikesQuery",
	}, user[1])
	verifyChange(t, change.Change{
		Change:      change.RemoveAction,
		Name:        "CreateUserAction",
		GraphQLName: "userCreate",
	}, user[2])
}

func TestAddIndex(t *testing.T) {
	fi := newFieldInfoTests(
		t,

		[]*input.Field{
			{
				Name: "email",
				Type: &input.FieldType{
					DBType: input.String,
				},
			},
		})

	s1 := &schema.Schema{
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

	s2 := &schema.Schema{
		Nodes: map[string]*schema.NodeDataInfo{
			"User": {
				NodeData: &schema.NodeData{
					NodeInfo:    nodeinfo.GetNodeInfo("user"),
					PackageName: "user",
					FieldInfo:   fi,
					Indices: []*input.Index{
						{
							Name:    "unique_email_idx",
							Unique:  true,
							Columns: []string{"email"},
						},
					},
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
		Change: change.AddIndex,
		Name:   "unique_email_idx",
	}, user[0])
	verifyChange(t, change.Change{
		Change:      change.ModifyNode,
		Name:        "User",
		GraphQLName: "User",
	}, user[1])
}

func TestRemoveIndex(t *testing.T) {
	fi := newFieldInfoTests(
		t,
		[]*input.Field{
			{
				Name: "email",
				Type: &input.FieldType{
					DBType: input.String,
				},
			},
		})

	s1 := &schema.Schema{
		Nodes: map[string]*schema.NodeDataInfo{
			"User": {
				NodeData: &schema.NodeData{
					NodeInfo:    nodeinfo.GetNodeInfo("user"),
					PackageName: "user",
					FieldInfo:   fi,
					Indices: []*input.Index{
						{
							Name:    "unique_email_idx",
							Unique:  true,
							Columns: []string{"email"},
						},
					},
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
					FieldInfo:   fi,
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
		Change: change.RemoveIndex,
		Name:   "unique_email_idx",
	}, user[0])
	verifyChange(t, change.Change{
		Change:      change.ModifyNode,
		Name:        "User",
		GraphQLName: "User",
	}, user[1])
}

func TestModifyIndex(t *testing.T) {
	fi := newFieldInfoTests(
		t,
		[]*input.Field{
			{
				Name: "email",
				Type: &input.FieldType{
					DBType: input.String,
				},
			},
		})

	s1 := &schema.Schema{
		Nodes: map[string]*schema.NodeDataInfo{
			"User": {
				NodeData: &schema.NodeData{
					NodeInfo:    nodeinfo.GetNodeInfo("user"),
					PackageName: "user",
					FieldInfo:   fi,
					Indices: []*input.Index{
						{
							Name:    "unique_email_idx",
							Unique:  true,
							Columns: []string{"email"},
						},
					},
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
					FieldInfo:   fi,
					Indices: []*input.Index{
						{
							Name:    "unique_email_idx",
							Columns: []string{"email"},
						},
					},
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
		Change: change.ModifyIndex,
		Name:   "unique_email_idx",
	}, user[0])
	verifyChange(t, change.Change{
		Change:      change.ModifyNode,
		Name:        "User",
		GraphQLName: "User",
	}, user[1])
}

func TestAddConstraint(t *testing.T) {
	fi := newFieldInfoTests(
		t,
		[]*input.Field{
			{
				Name: "price",
				Type: &input.FieldType{
					DBType: input.Float,
				},
			},
		})

	s1 := &schema.Schema{
		Nodes: map[string]*schema.NodeDataInfo{
			"Item": {
				NodeData: &schema.NodeData{
					NodeInfo:    nodeinfo.GetNodeInfo("item"),
					PackageName: "item",
					FieldInfo:   fi,
				},
			},
		},
	}

	s2 := &schema.Schema{
		Nodes: map[string]*schema.NodeDataInfo{
			"Item": {
				NodeData: &schema.NodeData{
					NodeInfo:    nodeinfo.GetNodeInfo("item"),
					PackageName: "item",
					FieldInfo:   fi,
					Constraints: []*input.Constraint{
						{
							Name:      "item_positive_price",
							Type:      input.CheckConstraint,
							Condition: "price > 0",
						},
					},
				},
			},
		},
	}

	m, err := schema.CompareSchemas(s1, s2)
	require.Nil(t, err)
	require.Len(t, m, 1)
	item := m["Item"]
	require.Len(t, item, 2)

	verifyChange(t, change.Change{
		Change: change.AddConstraint,
		Name:   "item_positive_price",
	}, item[0])
	verifyChange(t, change.Change{
		Change:      change.ModifyNode,
		Name:        "Item",
		GraphQLName: "Item",
	}, item[1])
}

func TestRemoveConstraint(t *testing.T) {
	fi, err := field.NewFieldInfoFromInputs(
		&codegenapi.DummyConfig{},
		"Item",
		[]*input.Field{
			{
				Name: "price",
				Type: &input.FieldType{
					DBType: input.Float,
				},
			},
		}, &field.Options{})
	require.Nil(t, err)

	s1 := &schema.Schema{
		Nodes: map[string]*schema.NodeDataInfo{
			"Item": {
				NodeData: &schema.NodeData{
					NodeInfo:    nodeinfo.GetNodeInfo("item"),
					PackageName: "item",
					FieldInfo:   fi,
					Constraints: []*input.Constraint{
						{
							Name:      "item_positive_price",
							Type:      input.CheckConstraint,
							Condition: "price > 0",
						},
					},
				},
			},
		},
	}

	s2 := &schema.Schema{
		Nodes: map[string]*schema.NodeDataInfo{
			"Item": {
				NodeData: &schema.NodeData{
					NodeInfo:    nodeinfo.GetNodeInfo("item"),
					PackageName: "item",
					FieldInfo:   fi,
				},
			},
		},
	}

	m, err := schema.CompareSchemas(s1, s2)
	require.Nil(t, err)
	require.Len(t, m, 1)
	item := m["Item"]
	require.Len(t, item, 2)

	verifyChange(t, change.Change{
		Change: change.RemoveConstraint,
		Name:   "item_positive_price",
	}, item[0])
	verifyChange(t, change.Change{
		Change:      change.ModifyNode,
		Name:        "Item",
		GraphQLName: "Item",
	}, item[1])
}

func TestModifyConstraint(t *testing.T) {
	fi, err := field.NewFieldInfoFromInputs(
		&codegenapi.DummyConfig{},
		"Item",
		[]*input.Field{
			{
				Name: "price",
				Type: &input.FieldType{
					DBType: input.Float,
				},
			},
			{
				Name: "discount_price",
				Type: &input.FieldType{
					DBType: input.Float,
				},
			},
		}, &field.Options{})
	require.Nil(t, err)

	s1 := &schema.Schema{
		Nodes: map[string]*schema.NodeDataInfo{
			"Item": {
				NodeData: &schema.NodeData{
					NodeInfo:    nodeinfo.GetNodeInfo("item"),
					PackageName: "item",
					FieldInfo:   fi,
					Constraints: []*input.Constraint{
						{
							Name:      "item_price_constraint",
							Type:      input.CheckConstraint,
							Condition: "price > 0",
							Columns:   []string{"price"},
						},
					},
				},
			},
		},
	}

	s2 := &schema.Schema{
		Nodes: map[string]*schema.NodeDataInfo{
			"Item": {
				NodeData: &schema.NodeData{
					NodeInfo:    nodeinfo.GetNodeInfo("item"),
					PackageName: "item",
					FieldInfo:   fi,
					Constraints: []*input.Constraint{
						{
							Name:      "item_price_constraint",
							Type:      input.CheckConstraint,
							Condition: "price > discount_price",
							Columns:   []string{"price", "discount_price"},
						},
					},
				},
			},
		},
	}

	m, err := schema.CompareSchemas(s1, s2)
	require.Nil(t, err)
	require.Len(t, m, 1)
	item := m["Item"]
	require.Len(t, item, 2)

	verifyChange(t, change.Change{
		Change: change.ModifyConstraint,
		Name:   "item_price_constraint",
	}, item[0])
	verifyChange(t, change.Change{
		Change:      change.ModifyNode,
		Name:        "Item",
		GraphQLName: "Item",
	}, item[1])
}

func TestAddDBRows(t *testing.T) {
	s1 := &schema.Schema{
		Nodes: map[string]*schema.NodeDataInfo{
			"Role": {
				NodeData: &schema.NodeData{
					NodeInfo:    nodeinfo.GetNodeInfo("role"),
					PackageName: "role",
					EnumTable:   true,
				},
			},
		},
	}

	s2 := &schema.Schema{
		Nodes: map[string]*schema.NodeDataInfo{
			"Role": {
				NodeData: &schema.NodeData{
					NodeInfo:    nodeinfo.GetNodeInfo("role"),
					PackageName: "role",
					EnumTable:   true,
					DBRows: []map[string]interface{}{
						{
							"role": "admin",
						},
						{
							"role": "member",
						},
					},
				},
			},
		},
	}

	m, err := schema.CompareSchemas(s1, s2)
	require.Nil(t, err)
	require.Len(t, m, 1)
	item := m["Role"]
	require.Len(t, item, 2)

	verifyChange(t, change.Change{
		Change:      change.ModifiedDBRows,
		Name:        "Role",
		GraphQLName: "Role",
	}, item[0])
	verifyChange(t, change.Change{
		Change:      change.ModifyNode,
		Name:        "Role",
		GraphQLName: "Role",
	}, item[1])
}

func TestRemoveDBRows(t *testing.T) {
	s1 := &schema.Schema{
		Nodes: map[string]*schema.NodeDataInfo{
			"Role": {
				NodeData: &schema.NodeData{
					NodeInfo:    nodeinfo.GetNodeInfo("role"),
					PackageName: "role",
					EnumTable:   true,
					DBRows: []map[string]interface{}{
						{
							"role": "admin",
						},
						{
							"role": "member",
						},
					},
				},
			},
		},
	}

	s2 := &schema.Schema{
		Nodes: map[string]*schema.NodeDataInfo{
			"Role": {
				NodeData: &schema.NodeData{
					NodeInfo:    nodeinfo.GetNodeInfo("role"),
					PackageName: "role",
					EnumTable:   true,
				},
			},
		},
	}

	m, err := schema.CompareSchemas(s1, s2)
	require.Nil(t, err)
	require.Len(t, m, 1)
	item := m["Role"]
	require.Len(t, item, 2)

	verifyChange(t, change.Change{
		Change:      change.ModifiedDBRows,
		Name:        "Role",
		GraphQLName: "Role",
	}, item[0])
	verifyChange(t, change.Change{
		Change:      change.ModifyNode,
		Name:        "Role",
		GraphQLName: "Role",
	}, item[1])
}

func TestHideNodeFromGraphQL(t *testing.T) {
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
					NodeInfo:        nodeinfo.GetNodeInfo("user"),
					PackageName:     "user",
					HideFromGraphQL: true,
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
		Change:      change.RemoveNode,
		Name:        "User",
		GraphQLName: "User",
		GraphQLOnly: true,
	}, user[0])
	verifyChange(t, change.Change{
		Change:      change.ModifyNode,
		Name:        "User",
		GraphQLName: "User",
	}, user[1])
}

func TestHideNodeFromGraphQLWithActions(t *testing.T) {
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
			{
				Operation: ent.EditAction,
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
			{
				Operation: ent.EditAction,
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
					NodeInfo:        nodeinfo.GetNodeInfo("user"),
					PackageName:     "user",
					HideFromGraphQL: true,
					ActionInfo:      a2,
				},
			},
		},
	}

	m, err := schema.CompareSchemas(s1, s2)
	require.Nil(t, err)
	require.Len(t, m, 1)
	user := m["User"]
	require.Len(t, user, 4)
	verifyChange(t, change.Change{
		Change:      change.RemoveNode,
		Name:        "User",
		GraphQLName: "User",
		GraphQLOnly: true,
	}, user[0])

	// remove actions from graphql
	verifyChange(t, change.Change{
		Change:      change.RemoveAction,
		Name:        "CreateUserAction",
		GraphQLName: "userCreate",
		GraphQLOnly: true,
	}, user[1])
	verifyChange(t, change.Change{
		Change:      change.RemoveAction,
		Name:        "EditUserAction",
		GraphQLName: "userEdit",
		GraphQLOnly: true,
	}, user[2])

	verifyChange(t, change.Change{
		Change:      change.ModifyNode,
		Name:        "User",
		GraphQLName: "User",
	}, user[3])
}

// TODO come back to this...
// easier to do the second way when we go from hidden -> exposed
func zTestHideNodeFromGraphQLWithActionsHideFromGraphQLChanges(t *testing.T) {
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
			{
				Operation: ent.EditAction,
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
			{
				Operation: ent.EditAction,
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
					NodeInfo:        nodeinfo.GetNodeInfo("user"),
					PackageName:     "user",
					HideFromGraphQL: true,
					ActionInfo:      a2,
				},
			},
		},
	}

	m, err := schema.CompareSchemas(s1, s2)
	require.Nil(t, err)
	require.Len(t, m, 1)
	user := m["User"]
	require.Len(t, user, 4)
	verifyChange(t, change.Change{
		Change:      change.RemoveNode,
		Name:        "User",
		GraphQLName: "User",
		GraphQLOnly: true,
	}, user[0])

	// remove actions from graphql
	verifyChange(t, change.Change{
		Change:      change.RemoveAction,
		Name:        "CreateUserAction",
		GraphQLName: "userCreate",
		GraphQLOnly: true,
	}, user[1])
	verifyChange(t, change.Change{
		Change:      change.RemoveAction,
		Name:        "EditUserAction",
		GraphQLName: "userEdit",
		GraphQLOnly: true,
	}, user[2])

	verifyChange(t, change.Change{
		Change:      change.ModifyNode,
		Name:        "User",
		GraphQLName: "User",
	}, user[3])
}

func TestHideNodeFromGraphQLWithForeignKeyEdges(t *testing.T) {
	e1 := edge.NewEdgeInfo("user")
	require.Nil(t, e1.AddEdgeFromForeignKeyIndex(
		&codegenapi.DummyConfig{},
		"user_id",
		"contacts",
		"User",
	))

	e2 := edge.NewEdgeInfo("user")
	require.Nil(t, e2.AddEdgeFromForeignKeyIndex(&codegenapi.DummyConfig{},
		"user_id",
		"contacts",
		"User"))

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
					NodeInfo:        nodeinfo.GetNodeInfo("user"),
					PackageName:     "user",
					HideFromGraphQL: true,
					EdgeInfo:        e2,
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
		Change:      change.RemoveNode,
		Name:        "User",
		GraphQLName: "User",
		GraphQLOnly: true,
	}, user[0])

	// remove edge from graphql
	verifyChange(t, change.Change{
		Change:      change.RemoveEdge,
		Name:        "contacts",
		GraphQLName: "UserToContactsConnection",
		ExtraInfo:   "UserToContactsQuery",
		GraphQLOnly: true,
	}, user[1])

	verifyChange(t, change.Change{
		Change:      change.ModifyNode,
		Name:        "User",
		GraphQLName: "User",
	}, user[2])
}

func TestHideNodeFromGraphQLWithIndexedEdges(t *testing.T) {
	e1 := edge.NewEdgeInfo("user")
	require.Nil(t, e1.AddIndexedEdgeFromSource(
		&codegenapi.DummyConfig{},
		"ownerID",
		"owner_id",
		"User",
		&base.PolymorphicOptions{
			PolymorphicOptions: &input.PolymorphicOptions{},
		}))

	e2 := edge.NewEdgeInfo("user")
	require.Nil(t, e2.AddIndexedEdgeFromSource(
		&codegenapi.DummyConfig{},
		"ownerID",
		"owner_id",
		"User",
		&base.PolymorphicOptions{
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
					NodeInfo:        nodeinfo.GetNodeInfo("user"),
					PackageName:     "user",
					HideFromGraphQL: true,
					EdgeInfo:        e2,
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
		Change:      change.RemoveNode,
		Name:        "User",
		GraphQLName: "User",
		GraphQLOnly: true,
	}, user[0])

	// remove edge from graphql
	verifyChange(t, change.Change{
		Change: change.RemoveEdge,
		Name:   "ownerIDS",
		// no connection...
		GraphQLName: "",
		ExtraInfo:   "OwnerToUsersQuery",
		GraphQLOnly: true,
	}, user[1])

	verifyChange(t, change.Change{
		Change:      change.ModifyNode,
		Name:        "User",
		GraphQLName: "User",
	}, user[2])
}

func TestHideNodeFromGraphQLWithAssocEdges(t *testing.T) {
	e1, err := edge.EdgeInfoFromInput(
		&codegenapi.DummyConfig{},
		"user", &input.Node{
			AssocEdges: []*input.AssocEdge{
				{
					Name:       "Likes",
					SchemaName: "User",
				},
			},
		})
	require.Nil(t, err)
	e2, err := edge.EdgeInfoFromInput(
		&codegenapi.DummyConfig{},
		"user", &input.Node{
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
					NodeInfo:        nodeinfo.GetNodeInfo("user"),
					PackageName:     "user",
					HideFromGraphQL: true,
					EdgeInfo:        e2,
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
		Change:      change.RemoveNode,
		Name:        "User",
		GraphQLName: "User",
		GraphQLOnly: true,
	}, user[0])

	// remove edge from graphql
	verifyChange(t, change.Change{
		Change:      change.RemoveEdge,
		Name:        "Likes",
		GraphQLName: "UserToLikesConnection",
		ExtraInfo:   "UserToLikesQuery",
		GraphQLOnly: true,
	}, user[1])

	verifyChange(t, change.Change{
		Change:      change.ModifyNode,
		Name:        "User",
		GraphQLName: "User",
	}, user[2])
}

func TestExposeNodeToGraphQL(t *testing.T) {
	s1 := &schema.Schema{
		Nodes: map[string]*schema.NodeDataInfo{
			"User": {
				NodeData: &schema.NodeData{
					NodeInfo:        nodeinfo.GetNodeInfo("user"),
					PackageName:     "user",
					HideFromGraphQL: true,
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
		Change:      change.AddNode,
		Name:        "User",
		GraphQLName: "User",
		GraphQLOnly: true,
	}, user[0])
	verifyChange(t, change.Change{
		Change:      change.ModifyNode,
		Name:        "User",
		GraphQLName: "User",
	}, user[1])
}

func TestExposeNodeToGraphQLWithActions(t *testing.T) {
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
			{
				Operation: ent.EditAction,
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
			{
				Operation: ent.EditAction,
			},
		},
	})

	s1 := &schema.Schema{
		Nodes: map[string]*schema.NodeDataInfo{
			"User": {
				NodeData: &schema.NodeData{
					NodeInfo:        nodeinfo.GetNodeInfo("user"),
					PackageName:     "user",
					ActionInfo:      a1,
					HideFromGraphQL: true,
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
	require.Len(t, user, 4)
	verifyChange(t, change.Change{
		Change:      change.AddNode,
		Name:        "User",
		GraphQLName: "User",
		GraphQLOnly: true,
	}, user[0])

	// add actions to graphql
	verifyChange(t, change.Change{
		Change:      change.AddAction,
		Name:        "CreateUserAction",
		GraphQLName: "userCreate",
		GraphQLOnly: true,
	}, user[1])
	verifyChange(t, change.Change{
		Change:      change.AddAction,
		Name:        "EditUserAction",
		GraphQLName: "userEdit",
		GraphQLOnly: true,
	}, user[2])

	verifyChange(t, change.Change{
		Change:      change.ModifyNode,
		Name:        "User",
		GraphQLName: "User",
	}, user[3])
}

func TestExposeodeToGraphQLWithForeignKeyEdges(t *testing.T) {
	e1 := edge.NewEdgeInfo("user")
	require.Nil(t, e1.AddEdgeFromForeignKeyIndex(
		&codegenapi.DummyConfig{},
		"user_id",
		"contacts",
		"User",
	))

	e2 := edge.NewEdgeInfo("user")
	require.Nil(t, e2.AddEdgeFromForeignKeyIndex(&codegenapi.DummyConfig{},
		"user_id",
		"contacts",
		"User"))

	s1 := &schema.Schema{
		Nodes: map[string]*schema.NodeDataInfo{
			"User": {
				NodeData: &schema.NodeData{
					NodeInfo:        nodeinfo.GetNodeInfo("user"),
					PackageName:     "user",
					EdgeInfo:        e1,
					HideFromGraphQL: true,
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
		Change:      change.AddNode,
		Name:        "User",
		GraphQLName: "User",
		GraphQLOnly: true,
	}, user[0])

	// add edge to graphql
	verifyChange(t, change.Change{
		Change:      change.AddEdge,
		Name:        "contacts",
		GraphQLName: "UserToContactsConnection",
		ExtraInfo:   "UserToContactsQuery",
		GraphQLOnly: true,
	}, user[1])

	verifyChange(t, change.Change{
		Change:      change.ModifyNode,
		Name:        "User",
		GraphQLName: "User",
	}, user[2])
}

func TestExposeNodeToGraphQLWithIndexedEdges(t *testing.T) {
	e1 := edge.NewEdgeInfo("user")
	require.Nil(t, e1.AddIndexedEdgeFromSource(
		&codegenapi.DummyConfig{},
		"ownerID",
		"owner_id",
		"User",
		&base.PolymorphicOptions{
			PolymorphicOptions: &input.PolymorphicOptions{},
		}))

	e2 := edge.NewEdgeInfo("user")
	require.Nil(t, e2.AddIndexedEdgeFromSource(
		&codegenapi.DummyConfig{},
		"ownerID",
		"owner_id",
		"User",
		&base.PolymorphicOptions{
			PolymorphicOptions: &input.PolymorphicOptions{},
		}))

	s1 := &schema.Schema{
		Nodes: map[string]*schema.NodeDataInfo{
			"User": {
				NodeData: &schema.NodeData{
					NodeInfo:        nodeinfo.GetNodeInfo("user"),
					PackageName:     "user",
					EdgeInfo:        e1,
					HideFromGraphQL: true,
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
		Change:      change.AddNode,
		Name:        "User",
		GraphQLName: "User",
		GraphQLOnly: true,
	}, user[0])

	// add edge to graphql
	verifyChange(t, change.Change{
		Change: change.AddEdge,
		Name:   "ownerIDS",
		// no connection...
		GraphQLName: "",
		ExtraInfo:   "OwnerToUsersQuery",
		GraphQLOnly: true,
	}, user[1])

	verifyChange(t, change.Change{
		Change:      change.ModifyNode,
		Name:        "User",
		GraphQLName: "User",
	}, user[2])
}

func TestExposeNodeToGraphQLWithAssocEdges(t *testing.T) {
	e1, err := edge.EdgeInfoFromInput(
		&codegenapi.DummyConfig{},
		"user", &input.Node{
			AssocEdges: []*input.AssocEdge{
				{
					Name:       "Likes",
					SchemaName: "User",
				},
			},
		})
	require.Nil(t, err)
	e2, err := edge.EdgeInfoFromInput(
		&codegenapi.DummyConfig{},
		"user", &input.Node{
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
					NodeInfo:        nodeinfo.GetNodeInfo("user"),
					PackageName:     "user",
					EdgeInfo:        e1,
					HideFromGraphQL: true,
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
		Change:      change.AddNode,
		Name:        "User",
		GraphQLName: "User",
		GraphQLOnly: true,
	}, user[0])

	// add edge to graphql
	verifyChange(t, change.Change{
		Change:      change.AddEdge,
		Name:        "Likes",
		GraphQLName: "UserToLikesConnection",
		ExtraInfo:   "UserToLikesQuery",
		GraphQLOnly: true,
	}, user[1])

	verifyChange(t, change.Change{
		Change:      change.ModifyNode,
		Name:        "User",
		GraphQLName: "User",
	}, user[2])
}

func getEnumInfo(m map[string]string) *schema.EnumInfo {
	if m == nil {
		m = map[string]string{
			"Java":       "java",
			"CPlusPlus":  "c++",
			"CSharp":     "c#",
			"JavaScript": "js",
			"TypeScript": "ts",
			"GoLang":     "go",
			"Python":     "python",
		}
	}
	typ := "Language"

	tsEnum, gqlEnum := enum.GetEnums(&enum.Input{
		TSName:  typ,
		GQLName: typ,
		GQLType: typ,
		EnumMap: m,
	})
	return &schema.EnumInfo{
		Enum:    tsEnum,
		GQLEnum: gqlEnum,
	}
}

func getEnumInfoNoGQL(m map[string]string) *schema.EnumInfo {
	ret := getEnumInfo(m)
	return &schema.EnumInfo{
		Enum: ret.Enum,
	}
}

func createDuplicateAssocEdgeFromInput(t *testing.T, packageName string, inputEdge *input.AssocEdge) (*edge.AssociationEdge, *edge.AssociationEdge) {
	edge1, err := edge.AssocEdgeFromInput(
		&codegenapi.DummyConfig{},
		packageName,
		inputEdge)
	require.Nil(t, err)
	inputEdge2 := marshallAndUnmarshallInputAssocEdge(t, inputEdge)
	edge2, err := edge.AssocEdgeFromInput(
		&codegenapi.DummyConfig{},
		packageName,
		inputEdge2)
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
	ai, err := action.ParseFromInputNode(
		&codegenapi.DummyConfig{},
		nodeName, node, base.TypeScript)
	require.Nil(t, err)
	return ai
}

func verifyChange(t *testing.T, expChange, change change.Change) {
	assert.Equal(t, expChange.Change, change.Change)
	assert.Equal(t, expChange.Name, change.Name)
	assert.Equal(t, expChange.GraphQLName, change.GraphQLName)
	assert.Equal(t, expChange.GraphQLOnly, change.GraphQLOnly)
	assert.Equal(t, expChange.TSOnly, change.TSOnly)
	assert.Equal(t, expChange.ExtraInfo, change.ExtraInfo)
}
