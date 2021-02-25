import { graphql } from "react-relay";

const query = graphql`
  query homeQuery {
    viewer {
      user {
        id
        events(first: 10) {
          edges {
            node {
              id
              creator {
                id
                firstName
              }
              name
              eventActivities(first: 10) {
                edges {
                  node {
                    id
                    name
                    startTime
                    endTime
                    location
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
            }
            cursor
          }
          pageInfo {
            hasNextPage
          }
          rawCount
        }
      }
    }
  }
`;

export default query;
