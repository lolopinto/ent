package edge

import (
	"github.com/iancoleman/strcase"
)

// TODO kill this
type EntConfigInfo struct {
	PackageName string `json:"packageName"`
	NodeName    string
}

// TODO kill
func GetEntConfigFromName(packageName string) *EntConfigInfo {
	name := strcase.ToCamel(packageName)

	return &EntConfigInfo{
		PackageName: name,
		NodeName:    name,
	}
}
