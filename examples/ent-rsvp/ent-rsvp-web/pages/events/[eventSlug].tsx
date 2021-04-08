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
import Form from "react-bootstrap/Form";
import Link from "next/link";
import Col from "react-bootstrap/Col";
import guestGroupCreate from "../../src/mutations/guestGroupCreate";
import { guestGroupCreateMutationResponse } from "../../src/__generated__/guestGroupCreateMutation.graphql";
import guestGroupDelete from "../../src/mutations/guestGroupDelete";
import { MdEdit, MdDelete } from "react-icons/md";
import importGuests from "../../src/mutations/importGuests";
import EditActivity, {
  Activity,
  NewActivity,
} from "../../src/components/editActivity";
import activityEdit from "../../src/mutations/eventActivityEdit";
import addressEdit from "../../src/mutations/addressEdit";
import eventActivityCreate from "../../src/mutations/eventActivityCreate";
import eventActivityDelete from "../../src/mutations/eventActivityDelete";
import eventActivityAddInvite from "../../src/mutations/eventActivityAddInvite";
import eventActivityRemoveInvite from "../../src/mutations/eventActivityRemoveInvite";
import Address from "../../src/components/address";

const environment = createEnvironment();

export default function EventPage() {
  const router = useRouter();
  const [eventSlug, setEventSlug] = useState(null);
  useEffect(() => {
    if (router.query.eventSlug) {
      setEventSlug(router.query.eventSlug);
    }
  }, [router.query]);

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
    console.error(error);
    return "Error. sadness";
  }
  if (!props) {
    return null;
  }
  //  console.log(props);
  if (!props.event) {
    return <Alert variant="danger">Couldn't load event</Alert>;
  }

  return <EventsPage props={props} reloadData={retry} />;
}

function EventsPage(arg: { props: eventPageQueryResponse; reloadData }) {
  const event = arg.props.event;

  return (
    <Tabs defaultActiveKey="activities">
      <Tab eventKey="activities" title="Activities">
        <Activities event={event} reloadData={arg.reloadData} />
      </Tab>
      <Tab eventKey="guests" title="Guests">
        <Guests event={event} reloadData={arg.reloadData} />
      </Tab>
      <Tab eventKey="invites" title="Invites">
        <Invites event={event} reloadData={arg.reloadData} />
      </Tab>
    </Tabs>
  );
}

interface Guest {
  name: string;
  emailAddress: string;
  title?: string;
}

function Activities({ event, reloadData }) {
  const [addActivityMode, setAddActivityMode] = useState(false);
  const [editedActivity, setEditedActivity] = useState(null);

  function addActivity(e) {
    e.preventDefault();
    e.stopPropagation();
    setAddActivityMode(true);
    setEditedActivity(NewActivity());
  }

  function setValue(_, k: string, v: any) {
    const clone = { ...editedActivity };
    clone[k] = v;
    setEditedActivity(clone);
  }

  function onSave(e) {
    e.preventDefault();
    e.stopPropagation();

    eventActivityCreate(
      environment,
      {
        name: editedActivity.name,
        eventID: event.id,
        description: editedActivity.description,
        startTime: editedActivity.startTime,
        endTime: editedActivity.endTime,
        location: editedActivity.location,
        inviteAllGuests: editedActivity.inviteAllGuests,
        address: {
          street: editedActivity.street,
          city: editedActivity.city,
          state: editedActivity.state,
          zipCode: editedActivity.zipCode,
          apartment: editedActivity.apartment,
        },
      },
      function (r, errs) {
        if (errs && errs.length) {
          return console.error(errs);
        }
        setAddActivityMode(false);
        setEditedActivity(null);
        reloadData();
      },
    );
  }

  return (
    <Card style={{ paddingLeft: "10px" }}>
      <Card.Title>{event.name}</Card.Title>
      <Card.Subtitle>{event.eventActivities.rawCount} activities</Card.Subtitle>
      <Card.Body>
        {event.eventActivities.edges.map((edge, i) => (
          <Fragment key={`activity-${i}`}>
            <EventActivity
              activity={edge.node}
              reloadData={reloadData}
              event={event}
            />
          </Fragment>
        ))}
        {!addActivityMode && (
          <Link href="#">
            <a onClick={addActivity}>Add activity</a>
          </Link>
        )}
        {addActivityMode && (
          <Card style={{ margin: "10px", padding: "10px" }}>
            <Form onSubmit={onSave}>
              <EditActivity
                activity={editedActivity}
                setValue={setValue}
                i={0}
                saveButton={true}
              />
            </Form>
          </Card>
        )}
      </Card.Body>
    </Card>
  );
}

const renderGuestGroup = (guestGroup) => {
  return guestGroup.guests.nodes.map((guest, i) => (
    <Fragment key={i}>
      <div>
        {guest.name} {guest.emailAddress}
      </div>
    </Fragment>
  ));
};

function Guests({ event, reloadData }) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [currentDeletedGuestGroup, setCurrentDeletedGuestGroup] = useState(
    null,
  );

  const onDelete = (e, guestGroup) => {
    setCurrentDeletedGuestGroup(guestGroup);
    setShowDeleteModal(true);
    e.stopPropagation();
    e.preventDefault();
  };

  return (
    <Container>
      <Row>
        <Button variant="light" onClick={() => setShowCreateModal(true)}>
          Add Guests
        </Button>
        <Button variant="light" onClick={() => setShowImportModal(true)}>
          Import Guests
        </Button>
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
                  <MdDelete onClick={(e) => onDelete(e, guestGroupEdge.node)} />
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Row>
      <CreateGuestGroup
        eventID={event.id}
        show={showCreateModal}
        setShow={setShowCreateModal}
        reloadData={reloadData}
      />
      <ImportGuests
        eventID={event.id}
        show={showImportModal}
        setShow={setShowImportModal}
        reloadData={reloadData}
      />
      <ConfirmDelete
        guestGroup={currentDeletedGuestGroup}
        showModal={showDeleteModal}
        eventID={event.id}
        setShowModal={setShowDeleteModal}
      />
    </Container>
  );
}

function Invites({ event, reloadData }) {
  const [editMode, setEditMode] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState(undefined);
  const renderInvitedEvents = (guestGroup) => {
    return guestGroup.invitedEvents.nodes.map((event, i) => (
      <Fragment key={i}>
        <div>{event.name}</div>
      </Fragment>
    ));
  };

  function edit(e) {
    e.stopPropagation();
    e.preventDefault();
    setEditMode(true);
  }

  function onChange(e) {
    setSelectedActivity(e.target.value);
  }

  function invitationChanged(id: string, invited: boolean) {
    if (invited) {
      eventActivityAddInvite(
        environment,
        {
          eventActivityID: selectedActivity,
          inviteID: id,
        },
        function (r, errs) {
          if (errs && errs.length) {
            return console.error(errs);
          }
          reloadData();
        },
      );
    } else {
      eventActivityRemoveInvite(
        environment,
        {
          eventActivityID: selectedActivity,
          inviteID: id,
        },
        function (r, errs) {
          if (errs && errs.length) {
            return console.error(errs);
          }
          reloadData();
        },
      );
    }
  }

  if (editMode) {
    return (
      <Fragment>
        <Form>
          <Form.Group controlId="eventActivity">
            <Form.Label>Pick Activity to edit invites</Form.Label>
            <Form.Control as="select" size="sm" onChange={onChange}>
              <option key="choose" value={undefined}>
                choose
              </option>
              {event.eventActivities.edges.map((edge, i) => (
                <option key={edge.node.id} value={edge.node.id}>
                  {edge.node.name}
                </option>
              ))}
            </Form.Control>
          </Form.Group>
        </Form>
        {selectedActivity && (
          <Table striped bordered hover>
            <thead>
              <tr>
                <th>invited</th>
                <th>invitation name</th>
                <th>guests</th>
              </tr>
            </thead>

            <tbody>
              {event.guestGroups.edges.map((guestGroupEdge, i) => (
                <tr key={i}>
                  <td>
                    <Form.Group controlId={`invited-${guestGroupEdge.node.id}`}>
                      <Form.Check
                        type="checkbox"
                        checked={guestGroupEdge.node.invitedEvents.nodes.some(
                          (activity) => activity.id === selectedActivity,
                        )}
                        onChange={(e) =>
                          invitationChanged(
                            guestGroupEdge.node.id,
                            e.target.checked,
                          )
                        }
                      />
                    </Form.Group>
                  </td>
                  <td>{guestGroupEdge.node.invitationName}</td>
                  <td>{renderGuestGroup(guestGroupEdge.node)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Fragment>
    );
  }

  return (
    <Container>
      <Link href="#">
        <a onClick={edit}>Edit invites</a>
      </Link>
      <Table striped bordered hover>
        <thead>
          <tr>
            <th>invitation name</th>
            <th>count</th>
            <th>guests</th>
            <th>events invited</th>
          </tr>
        </thead>

        <tbody>
          {event.guestGroups.edges.map((guestGroupEdge, i) => (
            <tr key={i}>
              <td>{guestGroupEdge.node.invitationName}</td>
              <td>{guestGroupEdge.node.guests.rawCount}</td>
              <td>{renderGuestGroup(guestGroupEdge.node)}</td>
              <td>{renderInvitedEvents(guestGroupEdge.node)}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Container>
  );
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
        guests: guests.map((guest) => {
          return {
            name: guest.name,
            emailAddress: guest.emailAddress || null,
          };
        }),
      },
      async function (r: guestGroupCreateMutationResponse, errs) {
        if (errs && errs.length) {
          return console.error(`error creating guest group`);
        }
        // close modal
        setShow(false);
        reloadData();
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

function ImportGuests(props: {
  eventID: string;
  show: boolean;
  setShow;
  reloadData;
}) {
  const { eventID, show, setShow, reloadData } = props;
  const [file, setFile] = useState(null);
  const handleClose = () => setShow(false);

  const saveImportGuests = (e) => {
    e.preventDefault();
    e.stopPropagation();

    //    console.log(eventID, file);
    importGuests(environment, { eventID, file }, function (r, errs) {
      if (errs && errs.length) {
        return console.error("error importing guests");
      }

      // close
      handleClose();
      reloadData();
    });
  };

  const fileChanged = (e) => {
    const files = e.target.files;

    if (files.length !== 1) {
      throw new Error(`incorrect number of files selected`);
    }
    setFile(files[0]);
  };

  return (
    <Modal show={show} onHide={handleClose} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Import guests</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        Here are the guidelines for the csv:
        <ul>
          <li>
            enter column headers. The following are required: "invitationName",
            "name", "emailAddress".
          </li>
          <li>
            For additional guests in a group, they should be of the format:
            "additional guest ", "additional guest 2" etc.
          </li>
          <li>
            If any additional guest has an email address, add a column with
            "email" or "email address" added to the suffix like above.
          </li>
        </ul>
        <input
          type="file"
          id="file"
          name="file"
          accept=".csv"
          onChange={fileChanged}
        />
      </Modal.Body>
      <Modal.Footer>
        <Button variant="primary" onClick={saveImportGuests}>
          Import
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

function ConfirmActivityDelete({
  eventActivity,
  eventID,
  showModal,
  setShowModal,
}) {
  const deleteActivity = () => {
    //    delete activity
    eventActivityDelete(
      environment,
      eventID,
      {
        eventActivityID: eventActivity.id,
      },
      function (r, errs) {
        if (errs && errs.length) {
          console.error(errs);
        }
        setShowModal(false);
      },
    );
  };

  if (!showModal || !eventActivity) {
    return null;
  }

  return (
    <Modal show={showModal}>
      <Modal.Body>
        Are you sure you want to delete {eventActivity.name}?
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={() => setShowModal(false)}>
          No, don't delete
        </Button>
        <Button variant="primary" onClick={() => deleteActivity()}>
          Yes, I'm sure
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

function EventActivity({ activity, reloadData, event }) {
  const [editing, setEditing] = useState(false);
  const [editedActivity, setEditedActivity] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  function editMode() {
    const edited: Activity = {
      name: activity.name,
      startTime: DateTime.fromISO(activity.startTime).toJSDate(),
      endTime: null,
      location: activity.location,
      description: activity.description,
      street: activity?.address.street,
      city: activity?.address.city,
      state: activity?.address.state,
      zipCode: activity?.address.zipCode,
      apartment: activity?.address.apartment,
      inviteAllGuests: activity.inviteAllGuests,
    };
    if (activity.endTime) {
      edited.endTime = DateTime.fromISO(activity.endTime).toJSDate();
    }
    setEditedActivity(edited);

    setEditing(true);
  }

  function onDelete(e) {
    e.preventDefault();
    e.stopPropagation();
    setShowDeleteModal(true);
  }

  function setValue(_, k: string, v: any) {
    const clone = { ...editedActivity };
    clone[k] = v;
    setEditedActivity(clone);
  }

  function onSave(e) {
    e.preventDefault();
    e.stopPropagation();

    if (!editedActivity) {
      throw new Error("tried to save when no activity was edited");
    }
    let activityDone = false;
    let addressDone = false;
    const done = () => {
      setEditing(false);
      setEditedActivity(null);
      reloadData();
    };
    activityEdit(
      environment,
      {
        eventActivityID: activity.id,
        name: editedActivity.name,
        startTime: editedActivity.startTime,
        endTime: editedActivity.endTime,
        location: editedActivity.location,
        description: editedActivity.description,
        inviteAllGuests: editedActivity.inviteAllGuests,
      },
      function (r, errs) {
        if (errs && errs.length) {
          return console.error(errs);
        }
        activityDone = true;
        addressDone && done();
      },
    );
    addressEdit(
      environment,
      {
        addressID: activity.address.id,
        street: editedActivity.street,
        city: editedActivity.city,
        state: editedActivity.state,
        zipCode: editedActivity.zipCode,
        apartment: editedActivity.apartment,
      },
      function (r, errs) {
        if (errs && errs.length) {
          return console.error(errs);
        }
        addressDone = true;
        activityDone && done();
      },
    );
  }
  if (editing && editedActivity) {
    return (
      <Card>
        <Form onSubmit={onSave}>
          <EditActivity
            activity={editedActivity}
            setValue={setValue}
            i={0}
            saveButton={true}
          />
        </Form>
      </Card>
    );
  }
  // TODO there should be a cancel edit button here if this were productionized but meh
  return (
    <Fragment>
      <ConfirmActivityDelete
        eventActivity={activity}
        eventID={event.id}
        showModal={showDeleteModal}
        setShowModal={setShowDeleteModal}
      />
      <Card style={{ margin: "10px" }}>
        <Card.Title style={{ paddingLeft: "5px" }}>
          {activity.name} <MdEdit onClick={editMode} />
          <MdDelete onClick={onDelete} />
        </Card.Title>
        <ListGroup variant="flush">
          <ListGroup.Item>Description: {activity.description}</ListGroup.Item>
          <ListGroup.Item>
            Start Time:{" "}
            <time dateTime={activity.startTime}>
              {DateTime.fromISO(activity.startTime).toFormat(
                "MM-dd-yyyy hh:mm",
              )}
            </time>
          </ListGroup.Item>
          {activity.endTime && (
            <ListGroup.Item>
              End Time:
              <time dateTime={activity.endTime}>
                {DateTime.fromISO(activity.endTime).toFormat(
                  "MM-dd-yyyy hh:mm",
                )}
              </time>
            </ListGroup.Item>
          )}
          <ListGroup.Item>Location: {activity.location}</ListGroup.Item>
          <ListGroup.Item>
            <Address activity={activity} />
          </ListGroup.Item>
          <ListGroup.Item>
            Invite all guests: {activity.inviteAllGuests ? "Yes" : "No"}
          </ListGroup.Item>
        </ListGroup>
      </Card>
    </Fragment>
  );
}
