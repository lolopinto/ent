package edge

import (
	"testing"

	"github.com/lolopinto/ent/internal/codegen"
)

func TestEdgeInfo(t *testing.T) {
	edgeInfo := getTestEdgeInfo(t, "account")

	testEdgeInfo(t, edgeInfo, 0, 1, 1)

	edgeInfo = getTestEdgeInfo(t, "todo")

	testEdgeInfo(t, edgeInfo, 1, 0, 0)
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
	edge := edgeInfo.GetAssociationEdgeByName("Friends")

	if edge.GetEdgeName() != "Friends" {
		t.Errorf("edge name of friends association edge is not as expected, got %s instead", edge.EdgeName)
	}

	testEntConfig(t, edge.entConfig, "Account", "AccountConfig")

	testNodeInfo(t, edge.NodeInfo, "Account")
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

func parseConfigFileForFunc(t *testing.T) *codegen.FileConfigData {
	data := codegen.ParseFilesForTest(t)
	data.ParseEdgesFunc(t)
	return data
}
