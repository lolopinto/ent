package code

import (
	"github.com/lolopinto/ent/internal/codegen"
)

type Step struct {
}

func (s *Step) Name() string {
	return "codegen"
}

func (s *Step) ProcessData(data *codegen.Data) error {
	for _, info := range data.Schema.Nodes {
		if !info.ShouldCodegen {
			continue
		}
		nodeData := info.NodeData
		//fmt.Println(specificConfig, structName)
		if len(nodeData.PackageName) > 0 {
			if err := writeModelFile(nodeData, data.CodePath); err != nil {
				return err
			}
			if err := writePrivacyFile(nodeData); err != nil {
				return err
			}
			if err := writeMutationBuilderFile(nodeData, data.CodePath); err != nil {
				return err
			}

			for _, action := range nodeData.ActionInfo.Actions {
				if err := writeActionFile(nodeData, action, data.CodePath); err != nil {
					return err
				}
			}
		}
	}
	// right now it all panics but we have to change that lol
	return nil
}

var _ codegen.Step = &Step{}
