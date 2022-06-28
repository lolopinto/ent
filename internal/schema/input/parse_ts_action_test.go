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
				import {Schema, Action, Field, ActionOperation, StringType, TimestampType} from "{schema}";

				export default class Event implements Schema {
					fields: Field[] = [
						StringType({name: "name"}),
						TimestampType({name: "start_time"}),
					];

					actions: Action[] = [
						{
							operation: ActionOperation.Mutations,
						},
					];
				};`),
			},
			expectedNodes: map[string]node{
				"Event": {
					fields: []field{
						{
							name:   "name",
							dbType: input.String,
						},
						{
							name:   "start_time",
							dbType: input.Timestamp,
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
				import {Schema, Action, Field, ActionOperation, StringType, TimestampType} from "{schema}";

				export default class Event implements Schema {
					fields: Field[] = [
						StringType({name: "name"}),
						TimestampType({name: "start_time"}),
					];

					actions: Action[] = [
						{
							operation: ActionOperation.Delete,
						},
					];
				};`),
			},
			expectedNodes: map[string]node{
				"Event": {
					fields: []field{
						{
							name:   "name",
							dbType: input.String,
						},
						{
							name:   "start_time",
							dbType: input.Timestamp,
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
				import {Schema, Action, Field, ActionOperation, StringType, TimestampType} from "{schema}";

				export default class Event implements Schema {
					fields: Field[] = [
						StringType({name: "name"}),
						TimestampType({name: "start_time"}),
						TimestampType({name: "end_time", nullable: true}),
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
			expectedNodes: map[string]node{
				"Event": {
					fields: []field{
						{
							name:   "name",
							dbType: input.String,
						},
						{
							name:   "start_time",
							dbType: input.Timestamp,
						},
						{
							name:     "end_time",
							dbType:   input.Timestamp,
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
				import {Schema, Action, Field, ActionOperation, StringType, TimestampType} from "{schema}";

				export default class Event implements Schema {
					fields: Field[] = [
						StringType({name: "name"}),
						TimestampType({name: "start_time"}),
					];

					actions: Action[] = [
						{
							operation: ActionOperation.Create,
						},
					];
				};`),
			},
			expectedNodes: map[string]node{
				"Event": {
					fields: []field{
						{
							name:   "name",
							dbType: input.String,
						},
						{
							name:   "start_time",
							dbType: input.Timestamp,
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
		"action only fields": {
			code: map[string]string{
				"event.ts": getCodeWithSchema(
					`
				import {Schema, Action, Field, ActionOperation, StringType, TimestampType} from "{schema}";

				export default class Event implements Schema {
					fields: Field[] = [
						StringType({name: "name"}),
						TimestampType({name: "start_time"}),
					];

					actions: Action[] = [
						{
							operation: ActionOperation.Create,
							actionOnlyFields: [{
								name: "addCreatorAsAdmin",
								type: "Boolean",
							},
							{
								name: "localTime",
								type: "Time",
								nullable: true,
							}],
						},
					];
				};`),
			},
			expectedNodes: map[string]node{
				"Event": {
					fields: []field{
						{
							name:   "name",
							dbType: input.String,
						},
						{
							name:   "start_time",
							dbType: input.Timestamp,
						},
					},
					actions: []action{
						{
							operation: ent.CreateAction,
							actionOnlyFields: []actionField{
								{
									name: "addCreatorAsAdmin",
									typ:  input.ActionTypeBoolean,
								},
								{
									name:     "localTime",
									typ:      input.ActionTypeTime,
									nullable: true,
								},
							},
						},
					},
				},
			},
		},
	}
	runTestCases(t, testCases)
}
