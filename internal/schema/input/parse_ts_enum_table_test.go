package input_test

import (
	"testing"

	"github.com/lolopinto/ent/internal/schema/input"
)

func TestEnumTable(t *testing.T) {
	testCases := map[string]testCase{
		"enum table": {
			code: map[string]string{
				"role.ts": getCodeWithSchema(`
				import {Schema, Field, StringType} from "{schema}";

				export default class Role implements Schema {
					fields: Field[] = [
						StringType({
							name: 'role',
							primaryKey: true,
						}),
					];

					enumTable = true;

					dbRows = [
						{
							role: 'admin',
						},
						{
							role: 'member',
						},
						{
							role: 'archived_member',
						},
						{
							role: 'super_admin',
						},
						{
							role: 'owner',
						},
					];
				};`),
			},
			expectedNodes: map[string]node{
				"Role": {
					fields: []field{
						{
							name:       "role",
							dbType:     input.String,
							primaryKey: true,
						},
					},
					enumTable: true,
					dbRows: []map[string]interface{}{
						{
							"role": "admin",
						},
						{
							"role": "member",
						},
						{
							"role": "archived_member",
						},
						{
							"role": "super_admin",
						},
						{
							"role": "owner",
						},
					},
				},
			},
		},
		"enum table with other fields": {
			code: map[string]string{
				"role.ts": getCodeWithSchema(`
				import {Schema, Field, StringType} from "{schema}";

				export default class Role implements Schema {
					fields: Field[] = [
						StringType({
							name: 'role',
							primaryKey: true,
						}),
						StringType({
							name: 'description',
						}),
					];

					enumTable = true;

					dbRows = [
						{
							role: 'admin',
							description: "Admin",
						},
						{
							role: 'member',
							description: "Member",
						},
						{
							role: 'archived_member',
							description: "Archived Member",
						},
						{
							role: 'super_admin',
							description: "Super Admin",
						},
						{
							role: 'owner',
							description: "Owner",
						},
					];
				};`),
			},
			expectedNodes: map[string]node{
				"Role": {
					fields: []field{
						{
							name:       "role",
							dbType:     input.String,
							primaryKey: true,
						},
						{
							name:   "description",
							dbType: input.String,
						},
					},
					enumTable: true,
					dbRows: []map[string]interface{}{
						{
							"role":        "admin",
							"description": "Admin",
						},
						{
							"role":        "member",
							"description": "Member",
						},
						{
							"role":        "archived_member",
							"description": "Archived Member",
						},
						{
							"role":        "super_admin",
							"description": "Super Admin",
						},
						{
							"role":        "owner",
							"description": "Owner",
						},
					},
				},
			},
		},
	}

	runTestCases(t, testCases)
}
