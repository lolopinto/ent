import { graphql } from "react-relay";

const query = graphql`
  query rsvpPageQuery($slug: String!) {
    event(slug: $slug) {
      id
    }
    viewer {
      guest {
        guestGroup {
          invitedActivities: guestGroupToInvitedEvents(first: 100) {
            nodes {
              id
              name
              description
              startTime
              endTime
              location
              event {
                id
              }
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
          guests {
            nodes {
              id
              name
              emailAddress
              title
              attending: guestToAttendingEvents {
                edges {
                  node {
                    id
                  }
                  dietaryRestrictions
                }
              }
              declined: guestToDeclinedEvents {
                nodes {
                  id
                }
              }
            }
          }
        }
      }
    }
  }
`;

export default query;
