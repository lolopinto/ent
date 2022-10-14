package input_test

import "testing"

func TestPatternsWithEdge(t *testing.T) {
	testCases := map[string]testCase{
		"likes": {
			code: map[string]string{
				"patterns/feedback.ts": getCodeWithSchema(`
				import { Edge, FieldMap, Pattern } from "{schema}";

				export default class Feedback implements Pattern {
					name = "feedback";
					fields: FieldMap = {};
					edges: Edge[] = [
						{
							name: "likers",
							schemaName: "User",
							inverseEdge: {
								name: "likes",
								edgeConstName: "UserToLikes",
							},
							edgeConstName: "ObjectToLikers",
						},
					];
				}
				`),
				"post_schema.ts": getCodeWithSchema(`
				import {EntSchema} from "{schema}";
				import Feedback from "./patterns/feedback";

				const PostSchema = new EntSchema({

					patterns: [new Feedback()],
					fields:  {},
				});
				export default PostSchema;
				`),
				"group_schema.ts": getCodeWithSchema(`
				import {EntSchema } from "{schema}";
				import Feedback from "./patterns/feedback";

				const GroupSchema = new EntSchema({

					patterns: [new Feedback()],
					fields: {},
				});
				export default GroupSchema;
				`),
			},
			expectedNodes: map[string]node{
				"Post": {
					fields: nodeFields(),
					assocEdges: []assocEdge{
						{
							name:       "likers",
							schemaName: "User",
							inverseEdge: &inverseAssocEdge{
								name:          "likes",
								edgeConstName: "UserToLikes",
							},
							edgeConstName: "ObjectToLikers",
							patternName:   "feedback",
						},
					},
				},
				"Group": {
					fields: nodeFields(),
					assocEdges: []assocEdge{
						{
							name:       "likers",
							schemaName: "User",
							inverseEdge: &inverseAssocEdge{
								name:          "likes",
								edgeConstName: "UserToLikes",
							},
							edgeConstName: "ObjectToLikers",
							patternName:   "feedback",
						},
					},
				},
			},
			expectedPatterns: map[string]pattern{
				"node": {
					name:   "node",
					fields: nodeFields(),
				},
				"feedback": {
					name: "feedback",
					assocEdges: []assocEdge{
						{
							name:       "likers",
							schemaName: "User",
							inverseEdge: &inverseAssocEdge{
								name:          "likes",
								edgeConstName: "UserToLikes",
							},
							edgeConstName: "ObjectToLikers",
						},
					},
				},
			},
		},
	}
	runTestCases(t, testCases)
}
