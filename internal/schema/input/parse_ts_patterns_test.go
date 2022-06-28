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
				"post.ts": getCodeWithSchema(`
				import {BaseEntSchema, FieldMap} from "{schema}";
				import Feedback from "./patterns/feedback";

				export default class Post extends BaseEntSchema {

					constructor() {
						super();
						this.addPatterns(new Feedback());
					}
					fields: FieldMap = {};
				}
				`),
				"group.ts": getCodeWithSchema(`
				import {BaseEntSchema, FieldMap} from "{schema}";
				import Feedback from "./patterns/feedback";

				export default class Group extends BaseEntSchema {

					constructor() {
						super();
						this.addPatterns(new Feedback());
					}
					fields: FieldMap = {};
				}
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
