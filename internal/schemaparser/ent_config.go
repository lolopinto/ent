package schemaparser

import (
	"fmt"
	"regexp"

	"github.com/davecgh/go-spew/spew"
	"github.com/iancoleman/strcase"
)

type EntConfigInfo struct {
	PackageName string
	ConfigName  string
}

func getNodeNameFromEntConfig(configName string) (string, error) {
	r := regexp.MustCompile("([A-Za-z]+)Config")
	match := r.FindStringSubmatch(configName)
	if len(match) == 2 {
		return match[1], nil
	}
	return "", fmt.Errorf("couldn't match EntConfig name")
}

func GetEntConfigFromName(packageName string) *EntConfigInfo {
	name := strcase.ToCamel(packageName)
	spew.Dump(name)

	return &EntConfigInfo{
		PackageName: name,
		ConfigName:  fmt.Sprintf("%sConfig", name),
	}
}

func GetEntConfigFromEntConfig(configName string) (*EntConfigInfo, error) {
	nodeName, err := getNodeNameFromEntConfig(configName)
	if err != nil {
		return nil, err
	}
	spew.Dump(nodeName, configName)
	return &EntConfigInfo{
		PackageName: nodeName,
		ConfigName:  configName,
	}, nil
}
