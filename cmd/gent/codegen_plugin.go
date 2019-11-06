package main

type entCodegenPlugin struct {
}

func (p *entCodegenPlugin) pluginName() string {
	return "ent_codegen"
}

func (p *entCodegenPlugin) processData(data *codegenData) error {
	for _, info := range data.schema.Nodes {
		if !info.ShouldCodegen {
			continue
		}
		nodeData := info.NodeData
		//fmt.Println(specificConfig, structName)
		if len(nodeData.PackageName) > 0 {
			writeModelFile(nodeData, data.codePath)
			writePrivacyFile(nodeData)
			writeMutationBuilderFile(nodeData, data.codePath)

			for _, action := range nodeData.ActionInfo.Actions {
				writeActionFile(nodeData, action, data.codePath)
			}
		}
	}
	// right now it all panics but we have to change that lol
	return nil
}

var _ codegenPlugin = &entCodegenPlugin{}
