import React, { Fragment, useEffect, useState } from "react";
import DatePicker from "react-datepicker";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import "react-datepicker/dist/react-datepicker.css";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";

export interface Activity {
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
  inviteAllGuests?: boolean;
}

export function NewActivity(): Activity {
  return {
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
    inviteAllGuests: false,
  };
}

interface args {
  activity: Activity;
  saveButton?: boolean;
  setValue: (n: number, k: string, v: any) => void;
  i: number;
}

export default function EditActivity(props: args) {
  const { activity, saveButton, setValue, i } = props;

  return (
    <Fragment>
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
            value={activity.street}
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
      <Form.Row>
        <Form.Group controlId={`inviteAllGuests-${i}`}>
          <Form.Check
            type="checkbox"
            checked={activity.inviteAllGuests}
            label="Invite All Guests to Activity"
            onChange={(e) => setValue(i, "inviteAllGuests", e.target.checked)}
          />
        </Form.Group>
      </Form.Row>
      {saveButton && (
        <Button size="sm" variant="primary" type="submit">
          Save
        </Button>
      )}
    </Fragment>
  );
}
