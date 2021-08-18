import { useState, Fragment } from "react";
import Layout from "../src/components/layout";
import { QueryRenderer } from "react-relay";
import createEnvironment from "../src/initRelayEnvironment";
import homeQuery from "../src/queries/home";
import {
  homeQuery as homeQueryOperation,
  homeQueryResponse,
} from "../src/__generated__/homeQuery.graphql";
import eventCreate from "../src/mutations/eventCreate";
import { eventCreateMutationResponse } from "../src/__generated__/eventCreateMutation.graphql";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Link from "next/link";
import { Environment, fetchQuery } from "relay-runtime";
import eventSlugAvailableQuery from "../src/queries/eventSlugAvailable";
import { eventSlugAvailableQueryResponse } from "../src/__generated__/eventSlugAvailableQuery.graphql";
import { useRouter } from "next/router";
const environment = createEnvironment();
import Card from "react-bootstrap/Card";
import EditActivity, { NewActivity } from "../src/components/editActivity";

export default function Home() {
  return (
    <Layout>
      <QueryRenderer<homeQueryOperation>
        environment={environment}
        query={homeQuery}
        variables={{}}
        render={renderHome}></QueryRenderer>
    </Layout>
  );
}
interface homeArgs {
  error: Error | null;
  props: homeQueryResponse;
}

function renderHome(args: homeArgs) {
  const { error, props } = args;
  if (error) {
    console.error(error);
    return "Error. sadness";
  }

  return <Events props={props} environment={environment} />;
}

function Events(arg: { props: homeQueryResponse; environment: Environment }) {
  const { props, environment } = arg;
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  //  console.log(props);
  if (!props) {
    return <>{"Logged in! Loading..."}</>;
  }

  const eventsConnection = props.viewer.user.events;
  const edges = eventsConnection.edges;
  if (eventsConnection.rawCount === 0) {
    console.log("no events");
  }

  function createEventClicked() {
    console.log("createEventClicked");
    setShowCreateEvent(true);
  }

  return (
    <div>
      {edges.map((edge, i) => (
        <Event key={i} event={edge.node} />
      ))}
      <Button size="lg" variant="primary" onClick={createEventClicked}>
        Create Event
      </Button>
      <CreateEvent environment={environment} visible={showCreateEvent} />
    </div>
  );
}

function CreateEvent({ environment, visible }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugAvailable, setSlugAvailable] = useState(true);
  const [activities, setActivities] = useState([]);
  const router = useRouter();
  //TODO timezone

  function handleSlugChange(val) {
    setSlug(val);
    fetchQuery(environment, eventSlugAvailableQuery, {
      slug: val,
    }).then((r: eventSlugAvailableQueryResponse) => {
      setSlugAvailable(r.eventSlugAvailable);
    });
  }

  function handleSubmit(event) {
    event.preventDefault();
    event.stopPropagation();
    console.log("submit called");
    eventCreate(
      environment,
      {
        name,
        slug,
        activities: activities.map((activity) => {
          return {
            name: activity.name,
            description: activity.description,
            startTime: activity.startTime,
            endTime: activity.endTime,
            location: activity.location,
            inviteAllGuests: activity.inviteAllGuests,
            address: {
              street: activity.street,
              city: activity.city,
              state: activity.state,
              zipCode: activity.zipCode,
              apartment: activity.apartment,
            },
          };
        }),
      },
      async function (r: eventCreateMutationResponse, errs) {
        if (errs && errs.length) {
          console.error(`error creating event`);
          return;
        }
        const eventSlug = r.eventCreate.event.slug;

        router.push(`events/${eventSlug}`);
      },
    );
  }

  function addActivity() {
    let activity = NewActivity();

    const clone = [...activities];
    clone.push(activity);
    setActivities(clone);
    console.log("add activity clicked");
  }

  function setValue(idx: number, key: string, value: any) {
    const clone = [...activities];
    const activity = clone[idx];
    activity[key] = value;
    clone[idx] = activity;
    setActivities(clone);
  }

  if (!visible) {
    return null;
  }
  return (
    <Form onSubmit={handleSubmit}>
      <Form.Group controlId="name">
        <Form.Label>Name</Form.Label>
        <Form.Control
          size="lg"
          autoFocus
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Form.Control.Feedback type="invalid">
          Please provide a valid Name for your event
        </Form.Control.Feedback>
      </Form.Group>
      <Form.Group controlId="slug">
        <Form.Label>Unique URL</Form.Label>
        <Form.Control
          size="lg"
          type="text"
          value={slug}
          onChange={(e) => handleSlugChange(e.target.value)}
          isInvalid={!slugAvailable}
          required
        />
        <Form.Control.Feedback type="invalid">
          Unique URL provided has been taken
        </Form.Control.Feedback>
      </Form.Group>
      {activities.map((activity, i) => (
        <Fragment key={i}>
          <EditActivity activity={activity} setValue={setValue} i={i} />
        </Fragment>
      ))}
      <Link href="#">
        <a onClick={addActivity}>Add activity</a>
      </Link>
      <div>
        <Button size="sm" type="submit">
          Save
        </Button>
      </div>
    </Form>
  );
}

function Event({ event }) {
  //  console.log(event.slug);
  return (
    <Card>
      <Link href={`/events/${event.slug ?? event.id}`}>
        <a>
          <Card.Title>{event.name}</Card.Title>
        </a>
      </Link>
      <Card.Subtitle>{event.eventActivities.rawCount} activities</Card.Subtitle>
    </Card>
  );
}
