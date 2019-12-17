package code

import "github.com/lolopinto/ent/internal/codegen"

type Step struct {
}

func (p *Step) Name() string {
	return "codegen"
}

func (p *Step) ProcessData(data *codegen.Data) error {
	for _, info := range data.Schema.Nodes {
		if !info.ShouldCodegen {
			continue
		}
		nodeData := info.NodeData
		//fmt.Println(specificConfig, structName)
		if len(nodeData.PackageName) > 0 {
			writeModelFile(nodeData, data.CodePath)
			writePrivacyFile(nodeData)
			writeMutationBuilderFile(nodeData, data.CodePath)

			for _, action := range nodeData.ActionInfo.Actions {
				writeActionFile(nodeData, action, data.CodePath)
			}
		}
	}
	// right now it all panics but we have to change that lol
	return nil
}

var _ codegen.Step = &Step{}
