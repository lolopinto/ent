import React, { useState } from "react";

import Alert from "react-bootstrap/Alert";
import Container from "react-bootstrap/Container";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import "bootstrap/dist/css/bootstrap.min.css";
import Link from "next/link";

import createEnvironment from "../src/initRelayEnvironment";
import userCreate from "../src/mutations/userCreate";
import { Environment } from "relay-runtime";
const environment = createEnvironment();

export default function Home() {
  const [loginVisible, setLoginVisible] = useState(true);
  const [registerVisible, setRegisterVisible] = useState(false);
  const [showLoginSuccess, setShowLoginSuccess] = useState(false);

  function toggle(event) {
    setLoginVisible(!loginVisible);
    setRegisterVisible(!registerVisible);
    event.preventDefault();
    event.stopPropagation();
  }

  function renderLink() {
    if (loginVisible) {
      return (
        <>
          or{" "}
          <Link href="#">
            <a onClick={toggle}>create an account</a>
          </Link>
        </>
      );
    }

    return (
      <>
        or{" "}
        <Link href="#">
          <a onClick={toggle}>sign in</a>
        </Link>
      </>
    );
  }

  function registeredSuccessfully() {
    setLoginVisible(true);
    setRegisterVisible(false);
    setShowLoginSuccess(true);
  }

  return (
    <Container className="p-3">
      <Alert show={showLoginSuccess} variant="success">
        Successfully created account. You may login with given credentials now.
      </Alert>
      <Login environment={environment} visible={loginVisible} />
      <Register
        environment={environment}
        visible={registerVisible}
        callback={registeredSuccessfully}
      />
      {renderLink()}
    </Container>
  );
}

function Login({ visible, environment }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [validated, setValidated] = useState(false);

  function handleSubmit(event) {
    const form = event.currentTarget;
    if (form.checkValidity() === false) {
      event.preventDefault();
      event.stopPropagation();
    }
    setValidated(true);
  }

  if (!visible) {
    return null;
  }
  return (
    <div className="Login">
      <Form noValidate validated={validated} onSubmit={handleSubmit}>
        <Form.Group controlId="email">
          <Form.Label>Email</Form.Label>
          <Form.Control
            size="lg"
            autoFocus
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Form.Control.Feedback type="invalid">
            Please provide a valid Email Address.
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
            Please provide a valid Password.
          </Form.Control.Feedback>
        </Form.Group>
        <Button block size="lg" type="submit">
          Login
        </Button>
      </Form>
    </div>
  );
}

interface registerProps {
  visible: boolean;
  environment: Environment;
  callback?: () => void;
}

function Register({ visible, environment, callback }: registerProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [validated, setValidated] = useState(false);
  const [showError, setShowError] = useState(false);

  function handleSubmit(event) {
    event.preventDefault();
    event.stopPropagation();
    const form = event.currentTarget;
    if (!form.checkValidity()) {
      return;
    }
    setValidated(true);
    userCreate(
      environment,
      firstName,
      lastName,
      email,
      password,
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
            autoFocus
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
          <Form.Label>Email</Form.Label>
          <Form.Control
            size="lg"
            autoFocus
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Form.Control.Feedback type="invalid">
            Please provide a valid Email address
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
