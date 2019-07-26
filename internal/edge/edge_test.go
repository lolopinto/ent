package edge

import (
	"testing"

	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/parsehelper"
)

func TestEdgeInfo(t *testing.T) {
	edgeInfo := getTestEdgeInfo(t, "account")

	testEdgeInfo(t, edgeInfo, 0, 1, 2)

	edgeInfo = getTestEdgeInfo(t, "todo")

	testEdgeInfo(t, edgeInfo, 1, 0, 0)

	edgeInfo = getTestEdgeInfo(t, "folder")

	testEdgeInfo(t, edgeInfo, 0, 0, 1)
}

func TestFieldEdge(t *testing.T) {
	edgeInfo := getTestEdgeInfo(t, "todo")
	edge := edgeInfo.GetFieldEdgeByName("Account")

	if edge.EdgeName != "Account" {
		t.Errorf("edge name of account field edge is not as expected, got %s instead", edge.EdgeName)
	}

	// TODO PackageName is useless and we should fix it/remove it in this instance
	testEntConfig(t, edge.entConfig, "Account", "AccountConfig")

	testNodeInfo(t, edge.NodeInfo, "Account")

	if edge.FieldName != "AccountID" {
		t.Errorf("field name of account field edge is not as expected, got %s instead", edge.FieldName)
	}
}

func TestForeignKeyEdge(t *testing.T) {
	edgeInfo := getTestEdgeInfo(t, "account")
	edge := edgeInfo.GetForeignKeyEdgeByName("Todos")

	if edge.EdgeName != "Todos" {
		t.Errorf("edge name of todo foreign key edge is not as expected, got %s instead", edge.EdgeName)
	}

	// TODO PackageName is useless and we should fix it/remove it in this instance
	testEntConfig(t, edge.entConfig, "Todo", "TodoConfig")

	testNodeInfo(t, edge.NodeInfo, "Todo")
}

func TestAssociationEdge(t *testing.T) {
	edgeInfo := getTestEdgeInfo(t, "account")
	edge := edgeInfo.GetAssociationEdgeByName("Folders")

	expectedAssocEdge := &AssociationEdge{
		EdgeConst: "AccountToFoldersEdge",
		commonEdgeInfo: getCommonEdgeInfo(
			"Folders",
			codegen.GetEntConfigFromName("folder"),
		),
	}

	testAssocEdge(t, edge, expectedAssocEdge)
}

func TestSymmetricAssociationEdge(t *testing.T) {
	edgeInfo := getTestEdgeInfo(t, "account")
	edge := edgeInfo.GetAssociationEdgeByName("Friends")

	expectedAssocEdge := &AssociationEdge{
		EdgeConst: "AccountToFriendsEdge",
		commonEdgeInfo: getCommonEdgeInfo(
			"Friends",
			codegen.GetEntConfigFromName("account"),
		),
		Symmetric: true,
	}

	testAssocEdge(t, edge, expectedAssocEdge)
}

func TestInverseAssociationEdge(t *testing.T) {
	edgeInfo := getTestEdgeInfo(t, "folder")
	edge := edgeInfo.GetAssociationEdgeByName("Todos")

	expectedAssocEdge := &AssociationEdge{
		EdgeConst: "FolderToTodosEdge",
		commonEdgeInfo: getCommonEdgeInfo(
			"Todos",
			codegen.GetEntConfigFromName("todo"),
		),
		InverseEdge: &InverseAssocEdge{
			EdgeConst: "TodoToFoldersEdge",
			commonEdgeInfo: getCommonEdgeInfo(
				"Folders",
				codegen.GetEntConfigFromName("folder"),
			),
		},
	}

	testAssocEdge(t, edge, expectedAssocEdge)
}

func testAssocEdge(t *testing.T, edge, expectedAssocEdge *AssociationEdge) {
	if edge.GetEdgeName() != expectedAssocEdge.EdgeName {
		t.Errorf(
			"name of edge was not as expected, expected %s, got %s instead",
			expectedAssocEdge.EdgeName,
			edge.EdgeName,
		)
	}

	edgeName := edge.GetEdgeName()

	if edge.EdgeConst != expectedAssocEdge.EdgeConst {
		t.Errorf(
			"edge const of edge %s was not as expected, expected %s, got %s instead",
			edgeName,
			expectedAssocEdge.EdgeConst,
			edge.EdgeConst,
		)
	}

	if edge.Symmetric != expectedAssocEdge.Symmetric {
		t.Errorf("assoc edge with name %s symmetric value was not as expected", edgeName)
	}

	testInverseAssociationEdge(t, edgeName, edge, expectedAssocEdge)

	expectedPackageName := expectedAssocEdge.entConfig.PackageName
	expectedConfigName := expectedAssocEdge.entConfig.ConfigName
	testEntConfig(t, edge.entConfig, expectedPackageName, expectedConfigName)

	testNodeInfo(t, edge.NodeInfo, expectedAssocEdge.NodeInfo.Node)
}

func testInverseAssociationEdge(t *testing.T, edgeName string, edge, expectedAssocEdge *AssociationEdge) {
	inverseEdge := edge.InverseEdge
	expectedInverseEdge := expectedAssocEdge.InverseEdge

	if expectedInverseEdge == nil && inverseEdge != nil {
		t.Errorf("expected inverse edge with edge name %s to be nil and it was not nil", edgeName)
		return
	}

	if expectedInverseEdge != nil && inverseEdge == nil {
		t.Errorf("expected inverse edge with edge name %s to be non-nil and it was nil", edgeName)
		return
	}

	if expectedInverseEdge == nil && inverseEdge == nil {
		return
	}

	if inverseEdge.GetEdgeName() != expectedInverseEdge.EdgeName {
		t.Errorf(
			"name of inverse edge for edge %s was not as expected, expected %s, got %s instead",
			edgeName,
			inverseEdge.EdgeName,
			expectedInverseEdge.EdgeName,
		)
	}

	if inverseEdge.EdgeConst != expectedInverseEdge.EdgeConst {
		t.Errorf(
			"edge const of inverse edge %s was not as expected, expected %s, got %s instead",
			edgeName,
			inverseEdge.EdgeConst,
			expectedInverseEdge.EdgeConst,
		)
	}

	expectedPackageName := inverseEdge.entConfig.PackageName
	expectedConfigName := inverseEdge.entConfig.ConfigName
	testEntConfig(t, inverseEdge.entConfig, expectedPackageName, expectedConfigName)

	testNodeInfo(t, inverseEdge.NodeInfo, expectedInverseEdge.NodeInfo.Node)
}

func testEdgeInfo(t *testing.T, edgeInfo *EdgeInfo, expFieldEdges, expForeignKeys, expAssocs int) {
	if len(edgeInfo.FieldEdges) != expFieldEdges {
		t.Errorf("expected %d field edges. got %d instead", expFieldEdges, len(edgeInfo.FieldEdges))
	}

	if len(edgeInfo.ForeignKeys) != expForeignKeys {
		t.Errorf("expected %d foreign key edges. got %d instead", expForeignKeys, len(edgeInfo.ForeignKeys))
	}

	if len(edgeInfo.Associations) != expAssocs {
		t.Errorf("expected %d association edges. got %d instead", expAssocs, len(edgeInfo.Associations))
	}
}

func testEntConfig(t *testing.T, entConfig codegen.EntConfigInfo, expectedPackageName, expectedConfigName string) {
	// TODO PackageName is useless and we should fix it/remove it in this instance
	if entConfig.PackageName != expectedPackageName {
		t.Errorf(
			"package name for ent config was not as expected. expected %s, got %s instead",
			expectedPackageName,
			entConfig.PackageName,
		)
	}
	if entConfig.ConfigName != expectedConfigName {
		t.Errorf(
			"config name for ent config was not as expected. expected %s, got %s instead",
			expectedConfigName,
			entConfig.ConfigName,
		)
	}
}

func testNodeInfo(t *testing.T, nodeInfo codegen.NodeInfo, expectedNodename string) {
	if nodeInfo.Node != expectedNodename {
		t.Errorf(
			"node info for ent config was not as expected, expected %s, got %s instead",
			expectedNodename,
			nodeInfo.Node,
		)
	}
}

func getTestEdgeInfo(t *testing.T, packageName string) *EdgeInfo {
	data := parseConfigFileForFunc(t)
	edgeInfo := ParseEdgesFunc(packageName, data.FuncMap[packageName])
	if edgeInfo == nil {
		t.Errorf("invalid edgeInfo retrieved")
	}
	return edgeInfo
}

func parseConfigFileForFunc(t *testing.T) *parsehelper.FileConfigData {
	data := parsehelper.ParseFilesForTest(t)
	data.ParseEdgesFunc(t)
	return data
}
