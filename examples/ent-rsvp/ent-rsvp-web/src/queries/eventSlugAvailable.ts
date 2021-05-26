import { graphql } from "react-relay";

const query = graphql`
  query eventSlugAvailableQuery($slug: String!) {
    eventSlugAvailable(slug: $slug)
  }
`;

export default query;
