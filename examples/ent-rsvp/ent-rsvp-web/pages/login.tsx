import { useState, useEffect } from "react";
import Layout from "../src/components/layout";
import Login from "../src/components/login";
import createEnvironment from "../src/initRelayEnvironment";
import { useSession } from "../src/session";
import { useRouter } from "next/router";

const environment = createEnvironment();
import Spinner from "react-bootstrap/Spinner";

export default function LoginPage() {
  const [session] = useSession();
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  useEffect(() => {
    setLoading(false);
    if (session && session?.viewer?.user) {
      router.push("/home");
    }
  }, [session]);

  if (loading || session) {
    // still loading and figuring things out
    return (
      <Layout allowLoggedout={true}>
        <Spinner animation="border" role="status">
          <span className="sr-only">Loading...</span>
        </Spinner>
      </Layout>
    );
  }

  return (
    <Layout allowLoggedout={true}>
      <Login environment={environment} visible />
    </Layout>
  );
}
