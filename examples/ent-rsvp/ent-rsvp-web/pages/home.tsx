import { useRouter } from "next/router";
import { useSession } from "../src/session";
import Container from "react-bootstrap/Container";

export default function Home() {
  const session = useSession();
  const router = useRouter();

  if (!session) {
    router.push("/login");
  
  return <Container className="p-3">Logged in!</Container>;
}
