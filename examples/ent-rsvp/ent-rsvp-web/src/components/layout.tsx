import Container from "react-bootstrap/Container";
import "bootstrap/dist/css/bootstrap.min.css";

export default function Layout(props) {
  return <Container className="p-3">{props.children}</Container>;
}
