import { Fragment, useEffect } from "react";
import Container from "react-bootstrap/Container";
import "bootstrap/dist/css/bootstrap.min.css";
import { useRouter } from "next/router";
import { useSession } from "../../src/session";

interface args {
  allowLoggedout?: boolean;
  children?: any;
}

export default function Layout(props: args) {
  const [session, loading] = useSession();
  const router = useRouter();
  useEffect(() => {
    if (props.allowLoggedout) {
      return;
    }
    if (!loading && !session) {
      router.push("/login");
    }
  }, [loading, session, props.allowLoggedout]);

  if (loading && !props.allowLoggedout) {
    return <Fragment>Loading...</Fragment>;
  }
  return <Container className="p-3">{props.children}</Container>;
}
