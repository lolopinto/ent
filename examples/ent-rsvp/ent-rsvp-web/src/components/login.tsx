import React, { useState } from "react";
import Alert from "react-bootstrap/Alert";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import "bootstrap/dist/css/bootstrap.min.css";
import authUser from "../mutations/authUser";
import { useRouter } from "next/router";
import { useSession } from "../session";

export default function Login({ visible, environment }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [validated, setValidated] = useState(false);
  const [showError, setShowError] = useState(false);
  const [session, setSession, clearSession] = useSession();
  const router = useRouter();

  function handleSubmit(event) {
    const form = event.currentTarget;
    const validity = form.checkValidity();
    setValidated(true);
    event.preventDefault();
    event.stopPropagation();
    if (validity === false) {
      return;
    }

    authUser(
      environment,
      {
        emailAddress: email,
        password: password,
      },
      (response, errors) => {
        if (errors) {
          console.error(errors);
          setShowError(true);
          return;
        }
        setSession(response.authUser.token, response.authUser.viewer);

        // redirect home after successful login.
        router.push("/home");
      },
    );
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
        <Alert show={showError} variant="danger">
          There was an error logging in
        </Alert>
      </Form>
    </div>
  );
}
