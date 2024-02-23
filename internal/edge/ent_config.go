package edge

import "github.com/lolopinto/ent/internal/names"

// TODO kill this
type EntConfigInfo struct {
	PackageName string `json:"packageName"`
	NodeName    string
}

// TODO kill
func GetEntConfigFromName(packageName string) *EntConfigInfo {
	name := names.ToClassType(packageName)

	return &EntConfigInfo{
		PackageName: name,
		NodeName:    name,
	}
}
