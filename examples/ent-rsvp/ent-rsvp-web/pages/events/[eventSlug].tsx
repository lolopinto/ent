import { Fragment, useState, useEffect } from "react";
import Layout from "../../src/components/layout";
import { useRouter } from "next/router";
import createEnvironment from "../../src/initRelayEnvironment";
import { QueryRenderer } from "react-relay";
import {
  eventPageQuery as eventQueryOperation,
  eventPageQueryResponse,
} from "../../src/__generated__/eventPageQuery.graphql";
import query from "../../src/queries/eventPage";
import Card from "react-bootstrap/Card";
import ListGroup from "react-bootstrap/ListGroup";
import { DateTime } from "luxon";
const environment = createEnvironment();

export default function EventPage() {
  const router = useRouter();
  const [eventSlug, setEventSlug] = useState(null);
  useEffect(() => {
    if (router.query.eventSlug) {
      setEventSlug(router.query.eventSlug);
    }
  }, [router.query]);
  console.log(eventSlug);
  return (
    <Layout>
      {eventSlug ? (
        <QueryRenderer<eventQueryOperation>
          environment={environment}
          query={query}
          variables={{ slug: eventSlug }}
          render={renderEventsPage}></QueryRenderer>
      ) : (
        ""
      )}
    </Layout>
  );
}

interface homeArgs {
  error: Error | null;
  props: eventPageQueryResponse;
}

function renderEventsPage(args: homeArgs) {
  const { error, props } = args;
  if (error) {
    return "Error. sadness";
  }
  if (!props) {
    return null;
  }
  console.log(props);
  const event = props.event;

  return (
    <Card>
      <Card.Title>{event.name}</Card.Title>
      <Card.Subtitle>{event.eventActivities.rawCount} activities</Card.Subtitle>
      <Card.Body>
        {event.eventActivities.edges.map((edge, i) => (
          <Fragment key={`activity-${i}`}>
            <Activity activity={edge.node} />
          </Fragment>
        ))}
      </Card.Body>
    </Card>
  );
}

function Activity({ activity }) {
  function renderAddress() {
    const address = activity.address;
    if (!address) {
      return null;
    }

    return (
      <Fragment>
        <div>
          {address.street} {address.apartment}
        </div>
        <div>
          {address.city}, {address.state} {address.zipCode}
        </div>
      </Fragment>
    );
  }
  return (
    <Card>
      <Card.Title>{activity.name}</Card.Title>
      <ListGroup variant="flush">
        <ListGroup.Item>Description: {activity.description}</ListGroup.Item>
        <ListGroup.Item>
          Start Time:{" "}
          <time dateTime={activity.startTime}>
            {DateTime.fromISO(activity.startTime).toFormat("MM-dd-yyyy hh:mm")}
          </time>
        </ListGroup.Item>
        {activity.endTime ? (
          <ListGroup.Item>
            End Time:
            <time dateTime={activity.endTime}>
              {DateTime.fromISO(activity.endTime).toFormat("MM-dd-yyyy hh:mm")}
            </time>
          </ListGroup.Item>
        ) : (
          ""
        )}
        <ListGroup.Item>{activity.location}</ListGroup.Item>
        <ListGroup.Item>{renderAddress()}</ListGroup.Item>
      </ListGroup>
    </Card>
  );
}
