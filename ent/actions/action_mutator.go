package actions

// // TODO
// type ActionWithValidators interface {
// 	GetValidators() bool
// }

// // TODO
// type ActionWithObservers interface {
// 	GetObservers() bool
// }

// order is, run all validators to make sure things are good
// then perform the main mutation
// then run all observers
// validators and observers not implemented yet

// TODO play with APIs. doesn't matter for now since it's going directly to graphql...
// Right now, the API is
/*
	useraction.CreateUser(viewer).
		SetFirstName("firstName").
		SetLastName("lastName").
		SetEmailAddress("emailAddress").
		SetEncryptedPassword("encryptedPassword").
		Save()
*/

/*
  maybe try
	useraction.CreateUser(
		viewer,
		//
		useraction.FirstName("firstName"),
		useraction.LastName("lastname"),
		useraction.EmailAddress("emailaddress"),
	).Save()
*/
