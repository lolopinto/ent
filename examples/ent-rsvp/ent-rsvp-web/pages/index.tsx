import React, { useState } from "react";

import Alert from "react-bootstrap/Alert";
import Container from "react-bootstrap/Container";
import "bootstrap/dist/css/bootstrap.min.css";
import Link from "next/link";

import createEnvironment from "../src/initRelayEnvironment";
import Login from "../src/components/login";
import Register from "../src/components/register";
import { useSession } from "../src/session";
import { useRouter } from "next/router";

const environment = createEnvironment();

export default function Index() {
  const [loginVisible, setLoginVisible] = useState(true);
  const [registerVisible, setRegisterVisible] = useState(false);
  const [showLoginSuccess, setShowLoginSuccess] = useState(false);
  const session = useSession();
  const router = useRouter();

  // logged in. go home
  if (session) {
    router.push("/home");
  }

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
    console.log("registerd");
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
