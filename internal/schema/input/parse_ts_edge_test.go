package input_test

import (
	"testing"

	"github.com/lolopinto/ent/internal/schema/input"
)

func TestParseEdges(t *testing.T) {
	testCases := map[string]testCase{
		"unique with inverse edge": testCase{
			code: map[string]string{
				"event.ts": getCodeWithSchema(
					`
				import Schema, {Field, Edge} from "{schema}";

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
			expectedOutput: map[string]node{
				"Event": node{
					fields: []field{},
					assocEdges: []assocEdge{
						assocEdge{
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
		"field edge with inverse edge": testCase{
			code: map[string]string{
				"event.ts": getCodeWithSchema(
					`
				import Schema, {Field, Edge} from "{schema}";
				import {StringType} from "{field}";

				export default class Event implements Schema {
					fields: Field[] = [
						StringType({name: "creatorID", fieldEdge:["User", "createdEvents"]}),
					];
				};`),
				"user.ts": getCodeWithSchema(
					`
				import Schema, {Field, Edge} from "{schema}";

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
			expectedOutput: map[string]node{
				"Event": node{
					fields: []field{
						field{
							name:      "creatorID",
							fieldEdge: &[2]string{"User", "createdEvents"},
							dbType:    input.String,
						},
					},
				},
				"User": node{
					assocEdges: []assocEdge{
						assocEdge{
							name:       "createdEvents",
							schemaName: "Event",
						},
					},
				},
			},
		},
		"symmetric edge": testCase{
			code: map[string]string{
				"user.ts": getCodeWithSchema(
					`
					import Schema, {Field, Edge} from "{schema}";
	
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
			expectedOutput: map[string]node{
				"User": node{
					fields: []field{},
					assocEdges: []assocEdge{
						assocEdge{
							name:       "friends",
							schemaName: "User",
							symmetric:  true,
						},
					},
				},
			},
		},
		"one-way edge": testCase{
			code: map[string]string{
				"post.ts": getCodeWithSchema(
					`
					import Schema, {Field, Edge} from "{schema}";
	
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
			expectedOutput: map[string]node{
				"Post": node{
					fields: []field{},
					assocEdges: []assocEdge{
						assocEdge{
							name:       "likers",
							schemaName: "User",
						},
					},
				},
			},
		},
		"edge group": testCase{
			code: map[string]string{
				"user.ts": getCodeWithSchema(
					`
					import Schema, {Field, Edge} from "{schema}";
	
					export default class User implements Schema {
						fields: Field[] = [];
	
						edges: Edge[] = [
							{
								name: "friendships",
								groupStatusName: "friendshipStatus",
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
			expectedOutput: map[string]node{
				"User": node{
					fields: []field{},
					assocEdgeGroups: []assocEdgeGroup{
						assocEdgeGroup{
							name:            "friendships",
							groupStatusName: "friendshipStatus",
							assocEdges: []assocEdge{
								assocEdge{
									name:       "friendRequests",
									schemaName: "User",
									inverseEdge: &inverseAssocEdge{
										name: "friendRequestsReceived",
									},
								},
								assocEdge{
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
	}

	runTestCases(t, testCases)
}
