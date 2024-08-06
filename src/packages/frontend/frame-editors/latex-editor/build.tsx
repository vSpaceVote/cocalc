/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: MS-RSL – see LICENSE.md for details
 */

/*
Show the last latex build log, i.e., output from last time we ran the LaTeX build process.
*/

import Ansi from "@cocalc/ansi-to-react";
import { Button } from "antd";

import { AntdTabItem, Tab, Tabs } from "@cocalc/frontend/antd-bootstrap";
import { React, Rendered, useRedux } from "@cocalc/frontend/app-framework";
import { Icon, Loading, r_join } from "@cocalc/frontend/components";
import Stopwatch from "@cocalc/frontend/editors/stopwatch/stopwatch";
import { path_split } from "@cocalc/util/misc";
import { COLORS } from "@cocalc/util/theme";
import { BuildCommand } from "./build-command";
import { use_build_logs, use_proc_infos } from "./hooks";
import { BUILD_SPECS, BuildLogs, ProcessInfos } from "./types";

interface Props {
  name: string;
  actions: any;
  path: string;
  font_size: number;
  status: string;
}

export const Build: React.FC<Props> = React.memo((props) => {
  const { name, actions, path, font_size: font_size_orig, status } = props;

  const font_size = 0.8 * font_size_orig;
  const build_logs: BuildLogs = use_build_logs(name);
  const proc_infos: ProcessInfos = use_proc_infos(name);
  const build_command = useRedux([name, "build_command"]);
  const build_command_hardcoded =
    useRedux([name, "build_command_hardcoded"]) ?? false;
  const knitr: boolean = useRedux([name, "knitr"]);
  const [active_tab, set_active_tab] = React.useState<string>(
    BUILD_SPECS.latex.label,
  );
  const [error_tab, set_error_tab] = React.useState(null);
  let no_errors = true;

  function render_tab_item(
    title: string,
    value: string,
    error?: boolean,
    time_str?: string,
  ): AntdTabItem {
    const style: React.CSSProperties = {
      fontFamily: "monospace",
      whiteSpace: "pre-line",
      color: COLORS.GRAY_D,
      background: COLORS.GRAY_LLL,
      display: active_tab === title ? "block" : "none",
      width: "100%",
      padding: "5px",
      fontSize: `${font_size}px`,
      overflowY: "auto",
      margin: "0",
    };
    const err_style = error ? { background: COLORS.ATND_BG_RED_L } : undefined;
    const tab_button = <div style={err_style}>{title}</div>;
    return Tab({
      key: title,
      eventKey: title,
      title: tab_button,
      style,
      children: (
        <>
          {time_str && `Build time: ${time_str}\n\n`}
          <Ansi>{value}</Ansi>
        </>
      ),
    });
  }

  function render_log(stage): AntdTabItem | undefined {
    if (build_logs == null) return;
    const x = build_logs.get(stage);
    if (!x) return;
    const value = x.get("stdout") + x.get("stderr");
    if (!value) return;
    const time: number | undefined = x.get("time");
    const time_str = time ? `(${(time / 1000).toFixed(1)} seconds)` : "";
    const title = BUILD_SPECS[stage].label;
    // highlights tab, if there is at least one parsed error
    const error =
      (build_logs.getIn([stage, "parse", "errors"]) as any).size > 0;
    // also show the problematic log to the user
    if (error) {
      no_errors = false;
      if (error_tab == null) {
        set_active_tab(title);
        set_error_tab(title);
      }
    }
    return render_tab_item(title, value, error, time_str);
  }

  function render_clean(): AntdTabItem | undefined {
    const value = build_logs?.getIn(["clean", "output"]) as any;
    if (!value) return;
    const title = "Clean Auxiliary Files";
    return render_tab_item(title, value);
  }

  function render_logs(): Rendered {
    if (status) return;

    const items: AntdTabItem[] = [];

    for (const log in BUILD_SPECS) {
      if (log === "clean" || log === "build") continue; // skip these
      const item = render_log(log);
      if (item) items.push(item);
    }
    const clean = render_clean();
    if (clean) items.push(clean);

    // check if active_tab is in the list of items.key
    if (items.length > 0) {
      if (!items.some((item) => item.key === active_tab)) {
        set_active_tab(items[0].key);
      }
    }

    return (
      <Tabs
        activeKey={active_tab}
        onSelect={set_active_tab}
        tabPosition={"left"}
        size={"small"}
        style={{ height: "100%", overflowY: "auto" }}
        items={items}
      />
    );
  }

  function render_build_command(): Rendered {
    return (
      <BuildCommand
        font_size={font_size}
        filename={path_split(path).tail}
        actions={actions}
        build_command={build_command}
        knitr={knitr}
        build_command_hardcoded={build_command_hardcoded}
      />
    );
  }

  function render_procs(): Rendered {
    if (!proc_infos) return;
    const infos: JSX.Element[] = [];
    proc_infos.forEach((info, key) => {
      if (!info || info.get("status") !== "running") return;
      const start = info.get("start");
      const { label } = BUILD_SPECS[key];
      infos.push(
        <Button
          key={key}
          size="small"
          onClick={() => window.alert(`term ${info.get("pid")}`)}
          icon={<Icon unicode={0x2620} />}
        >
          Stop {label}{" "}
          {start != null ? (
            <Stopwatch
              compact
              state="running"
              time={start}
              noLabel
              noDelete
              noButtons
            />
          ) : undefined}
        </Button>,
      );
    });
    return <div style={{ margin: "15px" }}>{r_join(infos)}</div>;
  }

  function render_status(): Rendered {
    if (status) {
      return (
        <div style={{ margin: "15px" }}>
          <Loading
            text={status}
            style={{
              fontSize: "10pt",
              textAlign: "center",
              marginTop: "15px",
              color: COLORS.GRAY,
            }}
          />
        </div>
      );
    }
  }

  // if all errors are fixed, clear the state remembering we had an active error tab
  const logs = render_logs();
  if (no_errors && error_tab != null) set_error_tab(null);

  return (
    <div
      className={"smc-vfill cocalc-latex-build-content"}
      style={{
        overflow: "hidden",
        padding: "5px 0 0 5px",
        fontSize: `${font_size}px`,
      }}
    >
      {render_build_command()}
      {render_status()}
      {render_procs()}
      {logs}
    </div>
  );
});
