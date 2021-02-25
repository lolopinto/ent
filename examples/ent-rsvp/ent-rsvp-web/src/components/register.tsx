import React, { useState } from "react";

import Alert from "react-bootstrap/Alert";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import "bootstrap/dist/css/bootstrap.min.css";

import userCreate from "../mutations/userCreate";
import emailAvailable from "../mutations/emailAvailable";
import { Environment } from "relay-runtime";
import { parseOneAddress } from "email-addresses";

interface registerProps {
  visible: boolean;
  environment: Environment;
  callback?: () => void;
}

export default function Register({
  visible,
  environment,
  callback,
}: registerProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [validated, setValidated] = useState(false);
  const [showError, setShowError] = useState(false);
  const [emailValid, setEmailValid] = useState(true);
  const [emailUnavailable, setEmailUnavailable] = useState(false);

  const handleEmailChange = (val) => {
    setEmail(val);
    const e = parseOneAddress(val);
    if (!e || e.type !== "mailbox") {
      setEmailValid(false);
    } else {
      emailAvailable(environment, { email: val }, function (response, errors) {
        if (response.emailAvailable) {
          setEmailValid(true);
        } else {
          setEmailValid(false);
          setEmailUnavailable(true);
        }
      });
    }
  };

  function handleSubmit(event) {
    const form = event.currentTarget;
    const validity = form.checkValidity();
    if (validity === false) {
      event.preventDefault();
      event.stopPropagation();
    }
    setValidated(true);
    if (validity) {
      userCreate(
        environment,
        {
          firstName,
          lastName,
          emailAddress: email,
          password,
        },
        (response, errors) => {
          if (errors) {
            console.error(errors);
            setShowError(true);
            return;
          }
          if (callback) {
            callback();
          }
        },
      );
    }
  }

  if (!visible) {
    return null;
  }

  return (
    <div className="Register">
      <Form noValidate validated={validated} onSubmit={handleSubmit}>
        <Form.Group controlId="firstName">
          <Form.Label>First Name</Form.Label>
          <Form.Control
            size="lg"
            autoFocus
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
          <Form.Control.Feedback type="invalid">
            Please provide a valid First Name.
          </Form.Control.Feedback>
        </Form.Group>
        <Form.Group controlId="lastName">
          <Form.Label>Last Name</Form.Label>
          <Form.Control
            size="lg"
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
          <Form.Control.Feedback type="invalid">
            Please provide a valid Last Name.
          </Form.Control.Feedback>
        </Form.Group>
        <Form.Group controlId="email">
          <Form.Label>Email Address</Form.Label>
          <Form.Control
            size="lg"
            type="email"
            value={email}
            onChange={(e) => handleEmailChange(e.target.value)}
            isInvalid={!emailValid}
            required
          />
          <Form.Control.Feedback type="invalid">
            {emailUnavailable && "Email Address is unavailable"}
            {!emailUnavailable && "Please provide a valid Email Address"}
          </Form.Control.Feedback>
        </Form.Group>
        <Form.Group controlId="password">
          <Form.Label>Password</Form.Label>
          <Form.Control
            size="lg"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Form.Control.Feedback type="invalid">
            Please provide a Password
          </Form.Control.Feedback>
        </Form.Group>
        <Button block size="lg" type="submit">
          Create Account
        </Button>
        <Alert show={showError} variant="danger">
          There was an error creating the account
        </Alert>
      </Form>
    </div>
  );
}
