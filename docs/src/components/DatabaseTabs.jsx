import React from "react";
import Tabs from "@theme/Tabs";
import TabItem from "@theme/TabItem";
import CodeBlock from "@theme/CodeBlock";

export default function DatabaseTabs({ lang, postgres, sqlite }) {
  return (
    <Tabs
      defaultValue="postgres"
      groupId="database"
      values={[
        { label: "Postgres", value: "postgres" },
        { label: "SQLite", value: "sqlite" },
      ]}>
      <TabItem value="postgres">
        <CodeBlock>{postgres}</CodeBlock>
      </TabItem>
      <TabItem value="sqlite">
        <CodeBlock>{sqlite}</CodeBlock>
      </TabItem>
    </Tabs>
  );
}
