package nodeinfo

import (
	"fmt"

	"github.com/jinzhu/inflection"
	"github.com/lolopinto/ent/internal/names"
)

// NodeInfo is a struct that's embedded by nodeTemplate and Edge
// stores information used in template generation
type NodeInfo struct {
	Node          string
	Nodes         string
	NodeResult    string
	NodesResult   string
	NodeLoader    string
	NodeInstance  string
	NodesSlice    string
	NodeType      string
	EntConfig     string
	EntConfigName string
	PackageName   string
}

// GetNodeInfo returns information about a Node for template generation
func GetNodeInfo(packageName string) NodeInfo {
	// convert from pacakgename to camel case
	nodeName := names.ToClassType(packageName)

	return NodeInfo{
		Node:  nodeName,                    // Contact
		Nodes: inflection.Plural(nodeName), // Contacts
		// TODO delete
		NodeResult: fmt.Sprintf("%sResult", nodeName), // ContactResult
		// TODO delete
		NodesResult: fmt.Sprintf("%sResult", inflection.Plural(nodeName)), // ContactsResult
		// TODO delete
		NodeLoader:   names.ToTsFieldName(nodeName, "Loader"), // contactLoader
		NodeInstance: names.ToTsFieldName(nodeName),           // contact
		// TODO delete
		NodesSlice: fmt.Sprintf("[]*%s", nodeName),  // []*Contact
		NodeType:   fmt.Sprintf("%sType", nodeName), // ContactType
		// TODO delete these
		EntConfig:     fmt.Sprintf("&configs.%sConfig{}", nodeName), // &configs.ContactConfig{}
		EntConfigName: fmt.Sprintf("%sConfig", nodeName),            // ContactConfig
		PackageName:   names.ToFilePathName(packageName),
	}
}

func NodeInfoEqual(n1, n2 NodeInfo) bool {
	// assuming if this is correct, everything else is
	return n1.Node == n2.Node
}
