package input_test

import (
	"testing"

	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/internal/enttype"
	"github.com/lolopinto/ent/internal/schema/input"
)

func TestParseEmbeddedActions(t *testing.T) {
	testCases := map[string]testCase{
		"nullable embedded action": {
			code: map[string]string{
				"address.ts": getAddressCode(),
				"event.ts": getCodeWithSchema(`
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
								name: "address",
								actionName: "CreateAddressAction",
								nullable: true,
								type: "Object",
							}],
						},
					];
				};`),
			},
			expectedOutput: map[string]node{
				"Address": getExpectedOutputAddress(),
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
									name:     "address",
									typ:      input.ActionTypeObject,
									nullable: true,
									tsType: &enttype.NullableObjectType{
										CommonObjectType: enttype.CommonObjectType{
											TSType:      "customAddressInput",
											ActionName:  "CreateAddressAction",
											GraphQLType: "AddressField",
										},
									},
								},
							},
						},
					},
				},
			},
		},
		"nullable list embedded action": {
			code: map[string]string{
				"address.ts": getAddressCode(),
				"event.ts": getCodeWithSchema(`
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
								name: "addresses",
								actionName: "CreateAddressAction",
								list: true,
								nullable: true,
								type: "Object",
							}],
						},
					];
				};`),
			},
			expectedOutput: map[string]node{
				"Address": getExpectedOutputAddress(),
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
									name:     "addresses",
									typ:      input.ActionTypeObject,
									nullable: true,
									tsType: &enttype.ListWrapperType{
										Nullable: true,
										Type: &enttype.ObjectType{
											CommonObjectType: enttype.CommonObjectType{
												TSType:      "customAddressInput",
												ActionName:  "CreateAddressAction",
												GraphQLType: "AddressField",
											},
										},
									},
								},
							},
						},
					},
				},
			},
		},
		"nullable list and contents embedded action": {
			code: map[string]string{
				"address.ts": getAddressCode(),
				"event.ts": getCodeWithSchema(`
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
								name: "addresses",
								actionName: "CreateAddressAction",
								list: true,
								nullable: "contentsAndList",
								type: "Object",
							}],
						},
					];
				};`),
			},
			expectedOutput: map[string]node{
				"Address": getExpectedOutputAddress(),
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
									name:     "addresses",
									typ:      input.ActionTypeObject,
									nullable: true,
									tsType: &enttype.ListWrapperType{
										Nullable: true,
										Type: &enttype.NullableObjectType{
											CommonObjectType: enttype.CommonObjectType{
												TSType:      "customAddressInput",
												ActionName:  "CreateAddressAction",
												GraphQLType: "AddressField",
											},
										},
									},
								},
							},
						},
					},
				},
			},
		},
		"nullable contents embedded action": {
			code: map[string]string{
				"address.ts": getAddressCode(),
				"event.ts": getCodeWithSchema(`
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
								name: "addresses",
								actionName: "CreateAddressAction",
								list: true,
								nullable: "contents",
								type: "Object",
							}],
						},
					];
				};`),
			},
			expectedOutput: map[string]node{
				"Address": getExpectedOutputAddress(),
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
									name: "addresses",
									typ:  input.ActionTypeObject,
									tsType: &enttype.ListWrapperType{
										Type: &enttype.NullableObjectType{
											CommonObjectType: enttype.CommonObjectType{
												TSType:      "customAddressInput",
												ActionName:  "CreateAddressAction",
												GraphQLType: "AddressField",
											},
										},
									},
								},
							},
						},
					},
				},
			},
		},
		"embedded action list not nullable": {
			code: map[string]string{
				"address.ts": getAddressCode(),
				"event.ts": getCodeWithSchema(`
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
								name: "addresses",
								actionName: "CreateAddressAction",
								list: true,
								type: "Object",
							}],
						},
					];
				};`),
			},
			expectedOutput: map[string]node{
				"Address": getExpectedOutputAddress(),
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
									name: "addresses",
									typ:  input.ActionTypeObject,
									tsType: &enttype.ListWrapperType{
										Type: &enttype.ObjectType{
											CommonObjectType: enttype.CommonObjectType{
												TSType:      "customAddressInput",
												ActionName:  "CreateAddressAction",
												GraphQLType: "AddressField",
											},
										},
									},
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

func getAddressCode() string {
	return getCodeWithSchema(`
	import {Schema, Action, Field, StringType, UUIDType, ActionOperation} from "{schema}";

	export default class Address implements Schema {
		fields: Field[] = [
			StringType({ name: "Street" }),
			StringType({ name: "City" }),
			StringType({ name: "State" }),
			StringType({ name: "ZipCode" }), 
		];

		actions: Action[] = [
			{
				operation: ActionOperation.Create,
			},
		];
	}`)
}

func getExpectedOutputAddress() node {
	return node{
		fields: []field{
			{
				name:   "Street",
				dbType: input.String,
			},
			{
				name:   "City",
				dbType: input.String,
			},
			{
				name:   "State",
				dbType: input.String,
			},
			{
				name:   "ZipCode",
				dbType: input.String,
			},
		},
		actions: []action{
			{
				operation: ent.CreateAction,
			},
		},
	}
}
