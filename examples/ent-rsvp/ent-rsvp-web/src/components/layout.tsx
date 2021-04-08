import { Fragment, useState, useEffect } from "react";
import Container from "react-bootstrap/Container";
import "bootstrap/dist/css/bootstrap.min.css";
import { useRouter } from "next/router";
import { useSession } from "../../src/session";

interface args {
  allowLoggedout?: boolean;
  allowGuest?: boolean;
  children?: any;
}

export default function Layout(props: args) {
  // there needs to be a delayed way of dealing with this in react...
  const [loading, setLoading] = useState(true);

  const [session] = useSession();
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

  return <Container className="p-3">{!loading && props.children}</Container>;
}
