import { graphql } from "react-relay";

const query = graphql`
  query eventPageQuery($slug: String!) {
    event(slug: $slug) {
      id
      name
      eventActivities(first: 10) {
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
  }
`;

export default query;
