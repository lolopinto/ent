import { graphql } from "react-relay";

const query = graphql`
  query eventPageQuery($slug: String!) {
    event(slug: $slug) {
      id
      name
      eventActivities(first: 10) @connection(key: "Event_eventActivities") {
        rawCount
        edges {
          cursor
          node {
            id
            name
            description
            startTime
            endTime
            location
            inviteAllGuests
            address {
              id
              street
              city
              state
              zipCode
              apartment
            }
          }
        }
      }
      guestGroups(first: 100) @connection(key: "Event_guestGroups") {
        edges {
          node {
            id
            invitationName
            guests {
              rawCount
              nodes {
                id
                name
                emailAddress
                title
              }
            }
            invitedEvents: guestGroupToInvitedEvents(first: 10) {
              nodes {
                id
                name
              }
            }
          }
        }
      }
    }
  }
`;

export default query;
