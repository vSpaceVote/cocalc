import { useMemo, useState, CSSProperties } from "react";
import { webapp_client } from "@cocalc/frontend/webapp-client";
import { Alert, Button, Input, Space } from "antd";
import { EditableContext } from "../fields/context";
import { useTable } from "../querydb/table-hook";
import { client_db } from "@cocalc/util/db-schema";
import { SelectTimeKey } from "./time-keys";
import Gallery from "./gallery";
import Grid from "./grid";
import Calendar from "./calendar";
import type { ViewType } from "../types";
import { Icon } from "@cocalc/frontend/components";
import { getTableDescription } from "../tables";
import { SCHEMA } from "@cocalc/util/db-schema";
import ViewMenu from "./view-menu";
import { fieldToLabel } from "../util";
import { useFilter } from "./filter";
import { debounce } from "lodash";
import { plural } from "@cocalc/util/misc";

interface Props {
  view: ViewType;
  table: string;
  style?: CSSProperties;
  height?: number | string;
  name: string;
}

export default function View({ table, view, style, height, name }: Props) {
  const { title, query, columns, allowCreate, changes } = useMemo(
    () => getTableDescription(table),
    [table]
  );

  const [timeKey, setTimeKey] = useState<string | undefined>(undefined);
  const rowKey = useMemo(() => {
    const dbtable = Object.keys(query)[0];
    if (!dbtable) {
      throw Error("invalid query");
    }
    const keys = client_db.primary_keys(dbtable);
    return keys[0];
  }, [table]);

  const {
    data: data0,
    refresh,
    editableContext,
    error: tableError,
  } = useTable({ query, changes });

  const {
    filteredData: data,
    setFilter,
    numHidden,
  } = useFilter({ data: data0 });

  async function addNew() {
    const dbtable = Object.keys(query)[0];

    const x: any = {};
    for (const timefield of ["created", "last_edited"]) {
      if (SCHEMA[dbtable].user_query?.set?.fields?.[timefield]) {
        x[timefield] = "NOW()";
      }
    }

    if (dbtable == "crm_tags") {
      // @ts-ignore -- TODO: need a new editor before it goes into the DB!
      x.name = "";
    }

    // TODO: show the error somehow, e.g., for crm_tags adding twice gives
    // an error...
    await webapp_client.query_client.query({
      query: { [dbtable]: x },
      options: [{ set: true }],
    });
    refresh();
  }

  const right = (
    <Space wrap style={{ float: "right" }}>
      <b>{title ?? fieldToLabel(table)}</b>
      {allowCreate && (
        <Button onClick={addNew}>
          <Icon name="plus-circle" /> New
        </Button>
      )}
      {!changes && (
        <Button onClick={refresh}>
          <Icon name="refresh" /> Refresh
        </Button>
      )}
    </Space>
  );

  const header = (
    <div>
      {right} <ViewMenu name={name} view={view} columns={columns} />
    </div>
  );
  let body;
  switch (view) {
    case "gallery":
      body = (
        <Gallery
          height={height}
          rowKey={rowKey}
          data={data}
          columns={columns}
          title={header}
        />
      );
      break;
    case "calendar":
      body = (
        <Calendar
          data={data}
          columns={columns}
          title={header}
          timeKey={timeKey}
          rowKey={rowKey}
        />
      );
      break;
    case "grid":
      body = <Grid data={data} columns={columns} title={header} />;
      break;
    default:
      body = <div>Unsupported view type "{view}"</div>;
  }

  return (
    <EditableContext.Provider value={editableContext}>
      <div style={style}>
        {tableError && (
          <Alert
            type="error"
            message="Database Query Error"
            description={tableError}
          />
        )}
        {view == "calendar" && (
          <SelectTimeKey onChange={setTimeKey} query={query} />
        )}
        <Space style={{ marginBottom: "5px" }}>
          <Input.Search
            allowClear
            placeholder="Filter View..."
            onSearch={setFilter}
            enterButton="Search"
            style={{ width: 300, marginBottom: "5px" }}
            onChange={debounce((e) => setFilter(e.target.value), 500)}
          />
          {numHidden > 0 ? (
            <Alert
              showIcon
              type="info"
              message={`${numHidden} ${plural(numHidden, "result")} not shown`}
            />
          ) : undefined}
        </Space>
        {body}
      </div>
    </EditableContext.Provider>
  );
}
