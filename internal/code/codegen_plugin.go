package code

import (
	"github.com/lolopinto/ent/internal/codegen"
)

type Step struct {
}

func (s *Step) Name() string {
	return "codegen"
}

func (s *Step) ProcessData(processor *codegen.Processor) error {
	for _, info := range processor.Schema.Nodes {
		if !info.ShouldCodegen {
			continue
		}
		nodeData := info.NodeData
		//fmt.Println(specificConfig, structName)
		if len(nodeData.PackageName) > 0 {
			if err := writeModelFile(nodeData, processor.Config); err != nil {
				return err
			}
			if err := writePrivacyFile(nodeData, processor.Config); err != nil {
				return err
			}
			if err := writeMutationBuilderFile(nodeData, processor.Config); err != nil {
				return err
			}

			for _, action := range nodeData.ActionInfo.Actions {
				if err := writeActionFile(nodeData, action, processor.Config); err != nil {
					return err
				}
			}
		}
	}
	// right now it all panics but we have to change that lol
	return nil
}

var _ codegen.Step = &Step{}
