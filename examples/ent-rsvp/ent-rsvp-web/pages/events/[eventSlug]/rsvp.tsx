import { Fragment, useState, useEffect } from "react";
import Layout from "../../../src/components/layout";
import { useRouter } from "next/router";
import createEnvironment from "../../../src/initRelayEnvironment";
import authGuest from "../../../src/mutations/authGuest";
import Alert from "react-bootstrap/Alert";
import Card from "react-bootstrap/Card";
import {
  rsvpPageQuery as rsvpQueryOp,
  rsvpPageQueryResponse,
} from "../../../src/__generated__/rsvpPageQuery.graphql";
import { QueryRenderer } from "react-relay";
import query from "../../../src/queries/rsvpPage";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import { DateTime } from "luxon";
import Address from "../../../src/components/address";
import Container from "react-bootstrap/Container";
import Form from "react-bootstrap/Form";

import { MdEdit, MdRestaurantMenu } from "react-icons/md";
import guestEdit from "../../../src/mutations/guestEdit";
import eventActivityRsvp from "../../../src/mutations/eventActivityRsvpStatusEdit";
import { Button } from "react-bootstrap";
import Link from "next/link";
import { useSession } from "../../../src/session";

const environment = createEnvironment();

export default function Rsvp() {
  const router = useRouter();
  const [eventSlug, setEventSlug] = useState(null);
  const [showError, setShowError] = useState(false);
  const [session, setSession, clearSession] = useSession();

  useEffect(() => {
    if (!session?.viewer.guest || !router.query.email) {
      return;
    }
    // wrong email
    if (session.viewer.guest.emailAddress != router.query.email) {
      clearSession();
    }
  }, [router.query.email, session]);

  useEffect(() => {
    if (session?.viewer?.guest) {
      return;
    }
    if (!router.query.eventSlug || !router.query.email || !router.query.code) {
      return;
    }
    authGuest(
      environment,
      {
        code: router.query.code as string,
        emailAddress: router.query.email as string,
      },
      (response, errors) => {
        if (errors) {
          console.error(errors);
          setShowError(true);
          return;
        }
        setSession(response.authGuest.token, response.authGuest.viewer);
      },
    );
  }, [router.query.eventSlug, router.query.email, router.query.code, session]);

  useEffect(() => {
    setEventSlug(router.query.eventSlug);
  }, [router.query.eventSlug]);

  return (
    <Layout allowGuest={true}>
      <Alert show={showError} variant="danger">
        There was an error logging in
      </Alert>
      {eventSlug && session?.viewer?.guest ? (
        <QueryRenderer<rsvpQueryOp>
          environment={environment}
          query={query}
          variables={{ slug: eventSlug }}
          render={renderRsvpPage}></QueryRenderer>
      ) : (
        ""
      )}
    </Layout>
  );
}

interface homeArgs {
  error: Error | null;
  props: rsvpPageQueryResponse;
  retry: () => void;
}

function renderRsvpPage(args: homeArgs) {
  const { error, props, retry } = args;

  if (error) {
    console.error(error);
    return "Error. sadness";
  }
  if (!props) {
    return null;
  }

  const eventID = props.event.id;
  if (
    !props.viewer.guest.guestGroup.invitedActivities.nodes.every(
      (node) => node.event.id === eventID,
    )
  ) {
    console.error("invalid event. sadness");
    return null;
  }
  return <RsvpPage props={props} reloadData={retry} />;
}

function RsvpPage(arg: { props: rsvpPageQueryResponse; reloadData }) {
  const activities = arg.props.viewer.guest.guestGroup.invitedActivities.nodes;

  const guests = arg.props.viewer.guest.guestGroup.guests.nodes;

  return (
    <Fragment>
      {activities.map((activity, i) => (
        <Card style={{ paddingLeft: "10px" }} key={i}>
          <Card.Title>
            {DateTime.fromISO(activity.startTime as string).toFormat(
              "yyyy LLL dd",
            )}
          </Card.Title>
          <Card.Body>
            <Row>
              <Col>
                {activity.name}
                <Address activity={activity} />
                <Time activity={activity} />
              </Col>
              <Col>
                {guests.map((guest, i) => (
                  <Guest
                    key={i}
                    guest={guest}
                    activity={activity}
                    reloadData={arg.reloadData}
                  />
                ))}
              </Col>
            </Row>
          </Card.Body>
        </Card>
      ))}
    </Fragment>
  );
}

function Time({ activity }) {
  if (!activity.endTime) {
    return (
      <Fragment>
        {DateTime.fromISO(activity.startTime as string).toFormat("HH:mm ZZZZ")}
      </Fragment>
    );
  }

  return (
    <Fragment>
      {DateTime.fromISO(activity.startTime as string).toFormat("HH:mm ZZZZ")}
      to {DateTime.fromISO(activity.endTime as string).toFormat("HH:mm ZZZZ")}
    </Fragment>
  );
}

function Guest({ guest, activity, reloadData }) {
  const [name, setName] = useState(guest.name);
  const [editingName, setEditingName] = useState(false);
  const [editingDietaryRestrictions, setEditingDietaryRestrictions] = useState(
    false,
  );
  const [dietaryRestrictions, setDietaryRestrictions] = useState("");
  const [attendingVariant, setAttendingVariant] = useState("outline-danger");
  const [declinedVariant, setDeclinedVariant] = useState("outline-danger");

  useEffect(() => {
    let attendingEdge = guest.attending.edges.find(
      (edge) => edge.node.id === activity.id,
    );
    setAttendingVariant(attendingEdge ? "danger" : "outline-danger");

    let declined = guest.declined.nodes.find((node) => node.id === activity.id);
    setDeclinedVariant(declined ? "danger" : "outline-danger");

    if (attendingEdge) {
      setDietaryRestrictions(attendingEdge.dietaryRestrictions || "");
    }

    if (guest) {
      setName(guest.name);
    }
  }, [guest]);

  const rsvp = (input) => {
    eventActivityRsvp(
      environment,
      {
        eventActivityID: activity.id,
        guestID: guest.id,
        rsvpStatus: input,
      },
      function (r, errs) {
        if (errs && errs.length) {
          return console.error(errs);
        }
        reloadData();
      },
    );
  };

  const cancelNameChange = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingName(false);
  };

  const cancelDietaryRestrictions = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingDietaryRestrictions(false);
  };

  const saveName = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingName(false);

    guestEdit(
      environment,
      {
        guestID: guest.id,
        name: name,
      },
      function (r, errs) {
        if (errs && errs.length) {
          return console.error(errs);
        }
        reloadData();
      },
    );
  };

  const saveDietaryRestrictions = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingDietaryRestrictions(false);

    eventActivityRsvp(
      environment,
      {
        eventActivityID: activity.id,
        guestID: guest.id,
        rsvpStatus: "ATTENDING",
        dietaryRestrictions: dietaryRestrictions,
      },
      function (r, errs) {
        if (errs && errs.length) {
          return console.error(errs);
        }
        reloadData();
      },
    );
  };

  return (
    <Container>
      {editingName && (
        <Fragment>
          <Form>
            <Form.Group controlId="name">
              <Form.Control
                size="sm"
                autoFocus
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </Form.Group>
          </Form>
          <Link href="#">
            <a onClick={cancelNameChange}>Cancel</a>
          </Link>{" "}
          <Link href="#">
            <a onClick={saveName}>Save</a>
          </Link>
        </Fragment>
      )}
      {editingDietaryRestrictions && (
        <Fragment>
          <Form>
            <Form.Group controlId="dietaryRestrictions">
              <Form.Control
                size="sm"
                autoFocus
                type="text"
                value={dietaryRestrictions}
                onChange={(e) => setDietaryRestrictions(e.target.value)}
                required
              />
            </Form.Group>
            <Form.Text>
              Please let us know if you have any dietary restrictions.
            </Form.Text>
          </Form>
          <Link href="#">
            <a onClick={cancelDietaryRestrictions}>Cancel</a>
          </Link>{" "}
          <Link href="#">
            <a onClick={saveDietaryRestrictions}>Save</a>
          </Link>
        </Fragment>
      )}
      <div>
        {!editingName && (
          <Fragment>
            {name}
            <MdEdit onClick={() => setEditingName(true)} />
            <MdRestaurantMenu
              onClick={() => setEditingDietaryRestrictions(true)}
            />
          </Fragment>
        )}
      </div>
      <Row>
        <Button
          size="sm"
          variant={attendingVariant}
          onClick={() => rsvp("ATTENDING")}>
          Will Attend
        </Button>
        <Button
          size="sm"
          variant={declinedVariant}
          onClick={() => rsvp("DECLINED")}>
          Will Not Attend
        </Button>
      </Row>
    </Container>
  );
}
