package configs

import (
	"time"

	"github.com/lolopinto/ent/ent"
)

// AccountConfig is the config for test accounts in test land
type AccountConfig struct {
	FirstName      string
	LastName       string `index:"true"`
	PhoneNumber    string `unique:"true"`
	NumberOfLogins int    `default:"0" graphql:"_"`
	// this should be nullable true also...
	LastLoginAt      time.Time `graphql:"lastLoginTime" db:"last_login_time"`
	Bio              string    `nullable:"true"`
	DateOfBirth      time.Time `nullable:"true"`
	ShowBioOnProfile bool      `nullable:"true"`
}

// GetTableName returns the underyling database table the account model's data is stored
func (config *AccountConfig) GetTableName() string {
	return "accounts"
}

// GetEdges returns the edges that this account is mapped to
func (config *AccountConfig) GetEdges() ent.EdgeMap {
	return ent.EdgeMap{
		"Friendships": ent.AssociationEdgeGroup{
			EdgeGroups: ent.AssocEdgeMap{
				"FriendRequests": &ent.AssociationEdge{
					EntConfig: AccountConfig{},
					InverseEdge: &ent.InverseAssocEdge{
						// inverse on the same edge need to be part of the same status
						// and accounted for
						EdgeName: "FriendRequestsReceived",
					},
				},
				"Friends": &ent.AssociationEdge{
					EntConfig: AccountConfig{},
					Symmetric: true,
				},
			},
			// this makes more sense for events than this but for tests....
			GroupStatusName: "FriendshipStatus",
			EdgeActions: ent.EdgeActions{
				&ent.EdgeActionConfig{
					Action:            ent.AddEdgeAction,
					CustomActionName:  "AccountFriendshipStatusAction",
					CustomGraphQLName: "accountSetFriendshipStatus",
				},
			},
		},
		// edge from account -> folders. one-way edge with the inverse data being stored in the field
		"Folders": ent.AssociationEdge{
			EntConfig: FolderConfig{},
			EdgeActions: ent.EdgeActions{
				&ent.EdgeActionConfig{
					Action:            ent.AddEdgeAction,
					CustomActionName:  "AccountAddFolderAction", // AddFolderAction is default
					CustomGraphQLName: "accountFolderAdd",       // accountAddFolder
				},
				&ent.EdgeActionConfig{
					Action: ent.RemoveEdgeAction,
				},
			},
		},
		// just to have assoc version also
		"TodosAssoc": ent.AssociationEdge{
			EntConfig: TodoConfig{},
		},
	}
}

func (config *AccountConfig) GetActions() []*ent.ActionConfig {
	return []*ent.ActionConfig{
		&ent.ActionConfig{
			Action: ent.CreateAction,
		},
		&ent.ActionConfig{
			Action: ent.EditAction,
		},
	}
}
