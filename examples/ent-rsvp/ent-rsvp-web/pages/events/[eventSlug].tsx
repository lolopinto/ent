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
import Alert from "react-bootstrap/Alert";
import Tab from "react-bootstrap/Tab";
import Tabs from "react-bootstrap/Tabs";
import Row from "react-bootstrap/Row";
import Button from "react-bootstrap/Button";
import Container from "react-bootstrap/Container";
import Table from "react-bootstrap/Table";
import Modal from "react-bootstrap/Modal";
import { Form } from "react-bootstrap";
import Link from "next/link";
import Col from "react-bootstrap/Col";
import guestGroupCreate from "../../src/mutations/guestGroupCreate";
import { guestGroupCreateMutationResponse } from "../../src/__generated__/guestGroupCreateMutation.graphql";
import guestCreate from "../../src/mutations/guestCreate";
import guestGroupDelete from "../../src/mutations/guestGroupDelete";
import { guestCreateMutationResponse } from "../../src/__generated__/guestCreateMutation.graphql";
import { MdDelete } from "react-icons/md";

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
  retry: () => void;
}

function renderEventsPage(args: homeArgs) {
  const { error, props, retry } = args;
  if (error) {
    return "Error. sadness";
  }
  if (!props) {
    return null;
  }
  console.log(props);
  if (!props.event) {
    return <Alert variant="danger">Couldn't load event</Alert>;
  }

  return <EventsPage props={props} reloadData={retry} />;
}

function EventsPage(arg: { props: eventPageQueryResponse; reloadData }) {
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [currentDeletedGuestGroup, setCurrentDeletedGuestGroup] = useState(
    null,
  );
  const event = arg.props.event;

  const renderGuestGroup = (guestGroup) => {
    return guestGroup.guests.nodes.map((guest, i) => (
      <Fragment key={i}>
        <div>
          {guest.name} {guest.emailAddress}
        </div>
      </Fragment>
    ));
  };

  const onDelete = (e, guestGroup) => {
    setCurrentDeletedGuestGroup(guestGroup);
    setShowDeleteModal(true);
    e.stopPropagation();
    e.preventDefault();
  };

  return (
    <Tabs defaultActiveKey="activities">
      <Tab eventKey="activities" title="Activities">
        <Card>
          <Card.Title>{event.name}</Card.Title>
          <Card.Subtitle>
            {event.eventActivities.rawCount} activities
          </Card.Subtitle>
          <Card.Body>
            {event.eventActivities.edges.map((edge, i) => (
              <Fragment key={`activity-${i}`}>
                <Activity activity={edge.node} />
              </Fragment>
            ))}
          </Card.Body>
        </Card>
      </Tab>
      <Tab eventKey="guests" title="Guests">
        <Container>
          <Row>
            <Button variant="light" onClick={() => setShowModal(true)}>
              Add Guests
            </Button>
            <Button variant="light">Import spreadsheet</Button>
          </Row>
          <Row>
            <Table striped bordered hover>
              <thead>
                <tr>
                  <th>invitation name</th>
                  <th>count</th>
                  <th>guests</th>
                  <th>actions</th>
                </tr>
              </thead>

              <tbody>
                {event.guestGroups.edges.map((guestGroupEdge, i) => (
                  <tr key={i}>
                    <td>{guestGroupEdge.node.invitationName}</td>
                    <td>{guestGroupEdge.node.guests.rawCount}</td>
                    <td>{renderGuestGroup(guestGroupEdge.node)}</td>
                    <td>
                      <MdDelete
                        onClick={(e) => onDelete(e, guestGroupEdge.node)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Row>
          <CreateGuestGroup
            eventID={event.id}
            show={showModal}
            setShow={setShowModal}
            reloadData={arg.reloadData}
          />
          <ConfirmDelete
            guestGroup={currentDeletedGuestGroup}
            showModal={showDeleteModal}
            eventID={event.id}
            setShowModal={setShowDeleteModal}
          />
        </Container>
      </Tab>
    </Tabs>
  );
}

interface Guest {
  name: string;
  emailAddress: string;
  title?: string;
}

function ConfirmDelete({ guestGroup, eventID, showModal, setShowModal }) {
  const deleteGuestGroup = () => {
    //    delete guest group
    guestGroupDelete(
      environment,
      eventID,
      {
        guestGroupID: guestGroup.id,
      },
      function (r, errs) {
        if (errs && errs.length) {
          console.error(errs);
        }
        setShowModal(false);
      },
    );
  };

  if (!showModal || !guestGroup) {
    return null;
  }

  return (
    <Modal show={showModal}>
      <Modal.Body>
        Are you sure you want to delete {guestGroup.invitationName}?
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={() => setShowModal(false)}>
          No, don't delete
        </Button>
        <Button variant="primary" onClick={() => deleteGuestGroup()}>
          Yes, I'm sure
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

function CreateGuestGroup(props: {
  eventID: string;
  show: boolean;
  setShow;
  reloadData;
}) {
  const { eventID, show, setShow, reloadData } = props;
  const handleClose = () => setShow(false);
  const [invitationName, setInvitationName] = useState("");
  const [guests, setGuests] = useState([]);
  const saveGuestGroup = (e) => {
    e.preventDefault();
    e.stopPropagation();

    guestGroupCreate(
      environment,
      {
        eventID,
        invitationName,
      },
      async function (r: guestGroupCreateMutationResponse, errs) {
        if (errs && errs.length) {
          console.error(`error creating guest group`);
        }

        const guestGroupID = r.guestGroupCreate.guestGroup.id;

        let doneCount = 0;
        let errCount = 0;

        guests.map((guest) => {
          guestCreate(
            environment,
            {
              guestGroupID,
              eventID,
              name: guest.name,
              emailAddress: guest.emailAddress || null,
            },
            function (r2, errs2) {
              if (errs2 && errs2.length) {
                errCount++;
                return;
              }
              doneCount++;
              if (doneCount == guests.length) {
                console.log("guest group created");
                // close modal
                setShow(false);
                // reload data for main page
                // TODO there really should be a way to get it as part of mutation but whatevs
                reloadData();
              }
            },
          );
        });
      },
    );
  };

  function addGuest(e) {
    let guest: Guest = { name: "", emailAddress: "" };
    const clone = [...guests];
    clone.push(guest);
    setGuests(clone);

    e.preventDefault();
    e.stopPropagation();
  }

  function setValue(idx: number, key: string, value: any) {
    const clone = [...guests];
    const guest = clone[idx];
    guest[key] = value;
    clone[idx] = guest;
    setGuests(clone);
  }

  return (
    <Modal show={show} onHide={handleClose} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Create guest group</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          <Form.Group controlId="invitationName">
            <Form.Label>Invitation Name:</Form.Label>
            <Form.Control
              size="lg"
              autoFocus
              type="text"
              value={invitationName}
              onChange={(e) => setInvitationName(e.target.value)}
              required
            />
          </Form.Group>
          {guests.map((guest, i) => (
            <Form.Row key={i}>
              <Form.Group as={Col} controlId={`name-${i}`}>
                <Form.Label>Name</Form.Label>
                <Form.Control
                  type="text"
                  value={guest.name}
                  onChange={(e) => setValue(i, "name", e.target.value)}
                  required
                />
              </Form.Group>
              <Form.Group as={Col} controlId={`emailAddress-${i}`}>
                <Form.Label>Email Address</Form.Label>
                <Form.Control
                  type="email"
                  value={guest.emailAddress}
                  onChange={(e) => setValue(i, "emailAddress", e.target.value)}
                />
              </Form.Group>
            </Form.Row>
          ))}
          <Link href="#">
            <a onClick={addGuest}>Add Guest</a>
          </Link>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="primary" onClick={saveGuestGroup}>
          Save
        </Button>
      </Modal.Footer>
    </Modal>
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
