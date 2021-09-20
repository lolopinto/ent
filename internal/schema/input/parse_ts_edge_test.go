package input_test

import (
	"testing"

	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/internal/schema/input"
)

func TestParseEdges(t *testing.T) {
	testCases := map[string]testCase{
		"unique with inverse edge": {
			code: map[string]string{
				"event.ts": getCodeWithSchema(
					`
				import {Schema, Field, Edge} from "{schema}";

				export default class Event implements Schema {
					fields: Field[] = [];

					edges: Edge[] = [
						{
							name: "creator",
							unique: true,
							schemaName: "User",
							inverseEdge: {
								name: "createdEvents",
							},
						},
					];
				};`),
			},
			expectedNodes: map[string]node{
				"Event": {
					fields: []field{},
					assocEdges: []assocEdge{
						{
							name:       "creator",
							schemaName: "User",
							unique:     true,
							inverseEdge: &inverseAssocEdge{
								name: "createdEvents",
							},
						},
					},
				},
			},
		},
		// shown to contrast with unique above
		"field edge with inverse edge": {
			code: map[string]string{
				"event.ts": getCodeWithSchema(
					`
				import {Schema, Field, Edge, StringType} from "{schema}";

				export default class Event implements Schema {
					fields: Field[] = [
						StringType({name: "creatorID", fieldEdge:{schema:"User", inverseEdge:"createdEvents"}}),
					];
				};`),
				"user.ts": getCodeWithSchema(
					`
				import {Schema, Field, Edge} from "{schema}";

				export default class User implements Schema {
					fields: Field[] = [];
					edges: Edge[] = [
						{
							name: "createdEvents",
							schemaName: "Event",
						},
					];
				};`),
			},
			expectedNodes: map[string]node{
				"Event": {
					fields: []field{
						{
							name:      "creatorID",
							fieldEdge: &input.FieldEdge{Schema: "User", InverseEdge: "createdEvents"},
							dbType:    input.String,
						},
					},
				},
				"User": {
					assocEdges: []assocEdge{
						{
							name:       "createdEvents",
							schemaName: "Event",
						},
					},
				},
			},
		},
		"symmetric edge": {
			code: map[string]string{
				"user.ts": getCodeWithSchema(
					`
					import {Schema, Field, Edge} from "{schema}";

					export default class User implements Schema {
						fields: Field[] = [];

						edges: Edge[] = [
							{
								name: "friends",
								symmetric: true,
								schemaName: "User",
							},
						];
					};`),
			},
			expectedNodes: map[string]node{
				"User": {
					fields: []field{},
					assocEdges: []assocEdge{
						{
							name:       "friends",
							schemaName: "User",
							symmetric:  true,
						},
					},
				},
			},
		},
		"one-way edge": {
			code: map[string]string{
				"post.ts": getCodeWithSchema(
					`
					import {Schema, Field, Edge} from "{schema}";

					export default class Post implements Schema {
						fields: Field[] = [];

						edges: Edge[] = [
							{
								name: "likers",
								schemaName: "User",
							},
						];
					};`),
			},
			expectedNodes: map[string]node{
				"Post": {
					fields: []field{},
					assocEdges: []assocEdge{
						{
							name:       "likers",
							schemaName: "User",
						},
					},
				},
			},
		},
		"edge group": {
			code: map[string]string{
				"user.ts": getCodeWithSchema(
					`
					import {Schema, Field, AssocEdgeGroup} from "{schema}";

					export default class User implements Schema {
						fields: Field[] = [];

						edgeGroups: AssocEdgeGroup[] = [
							{
								name: "friendships",
								groupStatusName: "friendshipStatus",
								nullStates: "canRequest",
								assocEdges: [
									{
										name: "friendRequests",
										schemaName: "User",
										inverseEdge: {
											name: "friendRequestsReceived",
										},
									},
									{
										name: "friends",
										schemaName: "User",
										symmetric: true,
									},
								],
							},
						];
					};`),
			},
			expectedNodes: map[string]node{
				"User": {
					fields: []field{},
					assocEdgeGroups: []assocEdgeGroup{
						{
							name:            "friendships",
							groupStatusName: "friendshipStatus",
							nullStates:      []string{"canRequest"},
							assocEdges: []assocEdge{
								{
									name:       "friendRequests",
									schemaName: "User",
									inverseEdge: &inverseAssocEdge{
										name: "friendRequestsReceived",
									},
								},
								{
									name:       "friends",
									schemaName: "User",
									symmetric:  true,
								},
							},
						},
					},
				},
			},
		},
		"edge actions": {
			code: map[string]string{
				"user.ts": getCodeWithSchema(
					`
				import {Schema, Field, Edge, ActionOperation} from "{schema}";

				export default class User implements Schema {
					fields: Field[] = [];
					edges: Edge[] = [
						{
							name: "friends",
							schemaName: "User",
							edgeActions: [
								{
									operation: ActionOperation.AddEdge,
								},
								{
									operation: ActionOperation.RemoveEdge,
									actionName: "RemoveFriendAction",
									graphQLName: "friendRemove",
								},
							],
						},
					];
				};`),
			},
			expectedNodes: map[string]node{
				"User": {
					assocEdges: []assocEdge{
						{
							name:       "friends",
							schemaName: "User",
							edgeActions: []action{
								{
									operation: ent.AddEdgeAction,
								},
								{
									operation:   ent.RemoveEdgeAction,
									actionName:  "RemoveFriendAction",
									graphQLName: "friendRemove",
								},
							},
						},
					},
				},
			},
		},
		"hidden edge from graphql": {
			code: map[string]string{
				"post.ts": getCodeWithSchema(
					`
					import {Schema, Field, Edge} from "{schema}";

					export default class Post implements Schema {
						fields: Field[] = [];

						edges: Edge[] = [
							{
								name: "likers",
								schemaName: "User",
								hideFromGraphQL: true,
							},
						];
					};`),
			},
			expectedNodes: map[string]node{
				"Post": {
					fields: []field{},
					assocEdges: []assocEdge{
						{
							name:            "likers",
							schemaName:      "User",
							hideFromGraphQL: true,
						},
					},
				},
			},
		},
		"assoc group": {
			code: map[string]string{
				"user.ts": getCodeWithSchema(
					`
				import {Schema, Field, AssocEdgeGroup, ActionOperation} from "{schema}";

				export default class User implements Schema {
					fields: Field[] = [];
					edgeGroups: AssocEdgeGroup[] = [
						{
							name: "friendships",
							groupStatusName: "friendshipStatus",
							nullStateFn:"friendshipStatus",
							nullStates: ["canRequest", "cannotRequest"],
							edgeAction: {
								operation: ActionOperation.EdgeGroup,
							},
							assocEdges: [
								{
									name: "outgoingRequest",
									schemaName: "User",
									inverseEdge: {
										name: "incomingRequest",
									},
								},
								{
									name: "friends",
									schemaName: "User",
									symmetric: true,
								},
							],
						},
					];
				};`),
			},
			expectedNodes: map[string]node{
				"User": {
					assocEdgeGroups: []assocEdgeGroup{
						{
							name:            "friendships",
							groupStatusName: "friendshipStatus",
							nullStates:      []string{"canRequest", "cannotRequest"},
							nullStateFn:     "friendshipStatus",
							assocEdges: []assocEdge{
								{
									name:       "outgoingRequest",
									schemaName: "User",
									inverseEdge: &inverseAssocEdge{
										name: "incomingRequest",
									},
								},
								{
									name:       "friends",
									schemaName: "User",
									symmetric:  true,
								},
							},
							edgeActions: []action{
								{
									operation: ent.EdgeGroupAction,
								},
							},
						},
					},
				},
			},
		},
		"group with action only fields": {
			code: map[string]string{
				"user.ts": getCodeWithSchema(
					`
				import {Schema, Field, AssocEdgeGroup, ActionOperation} from "{schema}";

				export default class User implements Schema {
					fields: Field[] = [];
					edgeGroups: AssocEdgeGroup[] = [
						{
							name: "friendships",
							groupStatusName: "friendshipStatus",
							nullStateFn:"friendshipStatus",
							nullStates: ["canRequest", "cannotRequest"],
							edgeAction: {
								operation: ActionOperation.EdgeGroup,
								actionOnlyFields: [{
									name: "blah",
									type: "String",
								}],
							},
							assocEdges: [
								{
									name: "outgoingRequest",
									schemaName: "User",
									inverseEdge: {
										name: "incomingRequest",
									},
								},
								{
									name: "friends",
									schemaName: "User",
									symmetric: true,
								},
							],
						},
					];	
				};`),
			},
			expectedNodes: map[string]node{
				"User": {
					assocEdgeGroups: []assocEdgeGroup{
						{
							name:            "friendships",
							groupStatusName: "friendshipStatus",
							nullStates:      []string{"canRequest", "cannotRequest"},
							nullStateFn:     "friendshipStatus",
							assocEdges: []assocEdge{
								{
									name:       "outgoingRequest",
									schemaName: "User",
									inverseEdge: &inverseAssocEdge{
										name: "incomingRequest",
									},
								},
								{
									name:       "friends",
									schemaName: "User",
									symmetric:  true,
								},
							},
							edgeActions: []action{
								{
									operation: ent.EdgeGroupAction,
									actionOnlyFields: []actionField{
										{
											name: "blah",
											typ:  input.ActionTypeString,
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
