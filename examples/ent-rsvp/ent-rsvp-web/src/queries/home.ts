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
              name
              slug
              eventActivities(first: 10) {
                rawCount
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
