import { graphql } from "react-relay";

const EventFragment = graphql`
  fragment eventFragment on Event {
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
`;

export default EventFragment;
