package input_test

import (
	"testing"

	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/internal/schema/input"
)

func TestParseActions(t *testing.T) {
	testCases := map[string]testCase{
		"mutations action": {
			code: map[string]string{
				"event.ts": getCodeWithSchema(
					`
				import {Schema, Action, Field, ActionOperation, StringType, TimeType} from "{schema}";

				export default class Event implements Schema {
					fields: Field[] = [
						StringType({name: "name"}),
						TimeType({name: "start_time"}),
					];

					actions: Action[] = [
						{
							operation: ActionOperation.Mutations,
						},
					];
				};`),
			},
			expectedOutput: map[string]node{
				"Event": {
					fields: []field{
						{
							name:   "name",
							dbType: input.String,
						},
						{
							name:   "start_time",
							dbType: input.Time,
						},
					},
					actions: []action{
						{
							operation: ent.MutationsAction,
						},
					},
				},
			},
		},
		"delete action": {
			code: map[string]string{
				"event.ts": getCodeWithSchema(
					`
				import {Schema, Action, Field, ActionOperation, StringType, TimeType} from "{schema}";

				export default class Event implements Schema {
					fields: Field[] = [
						StringType({name: "name"}),
						TimeType({name: "start_time"}),
					];

					actions: Action[] = [
						{
							operation: ActionOperation.Delete,
						},
					];
				};`),
			},
			expectedOutput: map[string]node{
				"Event": {
					fields: []field{
						{
							name:   "name",
							dbType: input.String,
						},
						{
							name:   "start_time",
							dbType: input.Time,
						},
					},
					actions: []action{
						{
							operation: ent.DeleteAction,
						},
					},
				},
			},
		},
		"edit action": {
			code: map[string]string{
				"event.ts": getCodeWithSchema(
					`
				import {Schema, Action, Field, ActionOperation, StringType, TimeType} from "{schema}";

				export default class Event implements Schema {
					fields: Field[] = [
						StringType({name: "name"}),
						TimeType({name: "start_time"}),
						TimeType({name: "end_time", nullable: true}),
					];

					actions: Action[] = [
						{
							operation: ActionOperation.Edit,
							fields: [
								"start_time",
								"end_time",
							],
							actionName: "EventEditTime",
							graphQLName: "eventEditTime",
						},
					];
				};`),
			},
			expectedOutput: map[string]node{
				"Event": {
					fields: []field{
						{
							name:   "name",
							dbType: input.String,
						},
						{
							name:   "start_time",
							dbType: input.Time,
						},
						{
							name:     "end_time",
							dbType:   input.Time,
							nullable: true,
						},
					},
					actions: []action{
						{
							operation: ent.EditAction,
							fields: []string{
								"start_time",
								"end_time",
							},
							actionName:  "EventEditTime",
							graphQLName: "eventEditTime",
						},
					},
				},
			},
		},
		"create action": {
			code: map[string]string{
				"event.ts": getCodeWithSchema(
					`
				import {Schema, Action, Field, ActionOperation, StringType, TimeType} from "{schema}";

				export default class Event implements Schema {
					fields: Field[] = [
						StringType({name: "name"}),
						TimeType({name: "start_time"}),
					];

					actions: Action[] = [
						{
							operation: ActionOperation.Create,
						},
					];
				};`),
			},
			expectedOutput: map[string]node{
				"Event": {
					fields: []field{
						{
							name:   "name",
							dbType: input.String,
						},
						{
							name:   "start_time",
							dbType: input.Time,
						},
					},
					actions: []action{
						{
							operation: ent.CreateAction,
						},
					},
				},
			},
		},
	}
	runTestCases(t, testCases)
}
