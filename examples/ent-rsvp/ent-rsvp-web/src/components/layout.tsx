import { Fragment, useEffect } from "react";
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
  const [session, loading] = useSession();
  const router = useRouter();
  const goLogin = () => {
    console.log("gologincalled");
    if (router.pathname !== "login") {
      router.push("/login");
    }
  };
  useEffect(() => {
    console.log("start", loading, session);
    if (props.allowLoggedout || loading) {
      return;
    }
    if (!loading && !session?.viewer) {
      goLogin();
      return;
    }

    console.log("vewer", session.viewer.guest);
    if (session.viewer.guest !== null && props.allowGuest) {
      return;
    }
    goLogin();
  }, [loading, session, props.allowLoggedout, props.allowGuest]);

  if (loading) {
    return <Fragment>Loading...</Fragment>;
  }
  return <Container className="p-3">{props.children}</Container>;
}
