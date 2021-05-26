import { Fragment, useState, useEffect } from "react";
import Container from "react-bootstrap/Container";
import "bootstrap/dist/css/bootstrap.min.css";
import { useRouter } from "next/router";
import { useSession } from "../../src/session";
import Navbar from "react-bootstrap/Navbar";
import { Nav } from "react-bootstrap";

interface args {
  allowLoggedout?: boolean;
  allowGuest?: boolean;
  children?: any;
}

export default function Layout(props: args) {
  // there needs to be a delayed way of dealing with this in react...
  const [loading, setLoading] = useState(true);

  const [session, _, clearSession] = useSession();
  const router = useRouter();
  const goLogin = () => {
    if (router.pathname !== "login") {
      router.push("/login");
    }
  };

  useEffect(() => {
    setLoading(false);
  }, [session]);

  useEffect(() => {
    if (props.allowLoggedout || loading) {
      return;
    }
    if (!session?.viewer) {
      goLogin();
      return;
    }

    if (
      (session.viewer.guest !== null && props.allowGuest) ||
      session.viewer.user
    ) {
      return;
    }

    goLogin();
  }, [session, props.allowLoggedout, props.allowGuest]);

  const logout = (e) => {
    clearSession();
    goLogin();
    e.preventDefault();
    e.stopPropagation();
  }

  return <Container className="p-3">
    <>
      {session?.viewer &&
        <Navbar bg="light">
          <Navbar.Brand href='/home'>Ent RSVP</Navbar.Brand>
          <Nav className="mr-auto"><Nav.Link href="#" onClick={logout}>Logout</Nav.Link></Nav>
        </Navbar>}
      {!loading && props.children}
    </>
  </Container>;
}
