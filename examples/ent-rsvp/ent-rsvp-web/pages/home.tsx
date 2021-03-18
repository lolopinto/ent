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
import eventActivityCreate from "../src/mutations/eventActivityCreate";
import { eventActivityCreateMutationResponse } from "../src/__generated__/eventActivityCreateMutation.graphql";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Link from "next/link";
import DatePicker from "react-datepicker";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import "react-datepicker/dist/react-datepicker.css";
import { Environment, fetchQuery } from "relay-runtime";
import eventSlugAvailableQuery from "../src/queries/eventSlugAvailable";
import { eventSlugAvailableQueryResponse } from "../src/__generated__/eventSlugAvailableQuery.graphql";
import { useRouter } from "next/router";
const environment = createEnvironment();
import Card from "react-bootstrap/Card";
import ListGroup from "react-bootstrap/ListGroup";

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
    return "Error. sadness";
  }

  return <Events props={props} environment={environment} />;
}

function Events(arg: { props: homeQueryResponse; environment: Environment }) {
  const { props, environment } = arg;
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  if (!props) {
    return <>{"Logged in! Loading"}</>;
  }

  console.log(props);
  const eventsConnection = props.viewer.user.events;
  const creatorID = props.viewer.user.id;
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
      <CreateEvent
        environment={environment}
        visible={showCreateEvent}
        creatorID={creatorID}
      />
    </div>
  );
}

interface Activity {
  name: string;
  startTime: Date;
  endTime: Date | null;
  location: string;
  description: string | null;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  apartment: string | null;
}

function CreateEvent({ environment, visible, creatorID }) {
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
      { name, creatorID, slug },
      async function (r: eventCreateMutationResponse, errs) {
        if (errs && errs.length) {
          console.error(`error creating event`);
          return;
        }
        const eventID = r.eventCreate.event.id;
        const eventSlug = r.eventCreate.event.slug;

        let doneCount = 0;
        let errCount = 0;

        function goToEventPage() {
          router.push(`events/${eventSlug}`);
        }

        activities.map((activity) => {
          eventActivityCreate(
            environment,
            {
              name: activity.name,
              eventID,
              description: activity.description,
              startTime: activity.startTime,
              endTime: activity.endTime,
              location: activity.location,
              address: {
                street: activity.street,
                city: activity.city,
                state: activity.state,
                zipCode: activity.zipCode,
                apartment: activity.apartment,
              },
            },
            function (r: eventActivityCreateMutationResponse, errs) {
              if (errs && errs.length) {
                errCount += 1;
                return;
              }
              doneCount++;
              if (doneCount == activities.length) {
                //                route
                console.log("event created");
                goToEventPage();
              }
            },
          );
        });
        if (!activities.length) {
          goToEventPage();
        }

        console.log(r, errs);
      },
    );
  }

  function addActivity() {
    let activity: Activity = {
      name: "",
      startTime: new Date(),
      endTime: null,
      location: "",
      description: "",
      street: "",
      city: "",
      state: "",
      zipCode: "",
      apartment: "",
    };
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
          <Form.Group controlId={`activityName-${i}`}>
            <Form.Label>Activity Name</Form.Label>
            <Form.Control
              type="text"
              value={activity.name}
              onChange={(e) => setValue(i, "name", e.target.value)}
              required
            />
          </Form.Group>
          <Form.Group controlId={`description-${i}`}>
            <Form.Label>Description</Form.Label>
            <Form.Control
              as="textarea"
              value={activity.description}
              onChange={(e) => setValue(i, "description", e.target.value)}
            />
          </Form.Group>

          <Row>
            <Col>
              <Form.Label>Start Time: </Form.Label>
              <DatePicker
                selected={activity.startTime}
                onChange={(date) => setValue(i, "startTime", date)}
                showTimeSelect
                dateFormat={`MMMM d, h:mm aa`}
                timeIntervals={15}
                minDate={new Date()}
                timeFormat={`h:mm aa`}
              />
            </Col>
            <Col>
              <Form.Label>Optional end time: </Form.Label>
              <DatePicker
                selected={activity.endTime}
                onChange={(date) => setValue(i, "endTime", date)}
                showTimeSelect
                dateFormat={`MMMM d, h:mm aa`}
                timeIntervals={15}
                minDate={activity.startTime}
                timeFormat={`h:mm aa`}
                openToDate={activity.startTime}
              />
            </Col>
          </Row>

          <Form.Row>
            <Form.Group as={Col} controlId={`location-${i}`}>
              <Form.Label>Location:</Form.Label>
              <Form.Control
                type="text"
                value={activity.location}
                onChange={(e) => setValue(i, "location", e.target.value)}
                required
              />
            </Form.Group>
            <Form.Group as={Col} controlId={`address1-${i}`}>
              <Form.Label>Address 1:</Form.Label>
              <Form.Control
                type="text"
                value={activity.address}
                onChange={(e) => setValue(i, "street", e.target.value)}
                required
              />
            </Form.Group>
            <Form.Group as={Col} controlId={`apartment-${i}`}>
              <Form.Label>Apartment:</Form.Label>
              <Form.Control
                type="text"
                value={activity.apartment}
                onChange={(e) => setValue(i, "apartment", e.target.value)}
              />
            </Form.Group>
          </Form.Row>

          <Form.Row>
            <Form.Group as={Col} controlId={`city-${i}`}>
              <Form.Label>City:</Form.Label>
              <Form.Control
                type="text"
                value={activity.city}
                onChange={(e) => setValue(i, "city", e.target.value)}
                required
              />
            </Form.Group>
            <Form.Group as={Col} controlId={`state-${i}`}>
              <Form.Label>State:</Form.Label>
              <Form.Control
                type="text"
                value={activity.state}
                onChange={(e) => setValue(i, "state", e.target.value)}
                required
              />
            </Form.Group>
            <Form.Group as={Col} controlId={`zip-${i}`}>
              <Form.Label>Zip:</Form.Label>
              <Form.Control
                type="text"
                value={activity.zipCode}
                onChange={(e) => setValue(i, "zipCode", e.target.value)}
                required
              />
            </Form.Group>
          </Form.Row>
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
  console.log(event.slug);
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
