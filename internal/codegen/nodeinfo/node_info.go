package nodeinfo

import (
	"fmt"

	"github.com/iancoleman/strcase"
	"github.com/jinzhu/inflection"
)

// NodeInfo is a struct that's embedded by nodeTemplate and Edge
// stores information used in template generation
type NodeInfo struct {
	Node          string
	Nodes         string
	NodeResult    string
	NodesResult   string
	NodeLoader    string
	NewNodeLoader string
	NodeInstance  string
	NodesSlice    string
	NodeType      string
	EntConfig     string
	EntConfigName string
	PackageName string
}

// GetNodeInfo returns information about a Node for template generation
func GetNodeInfo(packageName string) NodeInfo {
	// convert from pacakgename to camel case
	nodeName := strcase.ToCamel(packageName)

	return NodeInfo{
		Node:          nodeName,                                                  // Contact
		Nodes:         inflection.Plural(nodeName),                               // Contacts
		NodeResult:    fmt.Sprintf("%sResult", nodeName),                         // ContactResult
		NodesResult:   fmt.Sprintf("%sResult", inflection.Plural(nodeName)),      // ContactsResult
		NodeLoader:    fmt.Sprintf("%sLoader", strcase.ToLowerCamel((nodeName))), // contactLoader
		NewNodeLoader: fmt.Sprintf("New%sLoader", strcase.ToCamel((nodeName))),   // NewContactLoader
		NodeInstance:  strcase.ToLowerCamel(nodeName),                            // contact
		NodesSlice:    fmt.Sprintf("[]*%s", nodeName),                            // []*Contact
		NodeType:      fmt.Sprintf("%sType", nodeName),                           // ContactType
		EntConfig:     fmt.Sprintf("&configs.%sConfig{}", nodeName),              // &configs.ContactConfig{}
		EntConfigName: fmt.Sprintf("%sConfig", nodeName),                         // ContactConfig
		PackageName:  strcase.ToSnake(packageName),
	}
}
