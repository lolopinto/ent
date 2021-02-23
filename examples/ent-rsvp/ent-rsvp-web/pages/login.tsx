import { useEffect } from "react";
import Layout from "../src/components/layout";
import Login from "../src/components/login";
import createEnvironment from "../src/initRelayEnvironment";
import { useSession } from "../src/session";
import { useRouter } from "next/router";

const environment = createEnvironment();

export default function LoginPage() {
  const [session, loading] = useSession();
  const router = useRouter();
  useEffect(() => {
    if (session) {
      router.push("/home");
    }
  });

  if (loading) {
    return "Loading...";
  }

  if (!session) {
    return null;
  }

  return (
    <Layout>
      <Login environment={environment} visible />
    </Layout>
  );
}
