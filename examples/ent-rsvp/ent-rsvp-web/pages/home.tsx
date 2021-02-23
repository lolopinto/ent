import { useRouter } from "next/router";
import { useSession } from "../src/session";
import { useEffect } from "react";
import Layout from "../src/components/layout";

export default function Home() {
  const [session, loading] = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !session) {
      router.push("/login");
    }
  }, [loading, session]);

  if (loading) {
    return "Loading...";
  }
  return <Layout>Logged in!</Layout>;
}
