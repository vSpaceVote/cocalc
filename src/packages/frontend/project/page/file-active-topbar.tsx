/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: AGPLv3 s.t. "Commons Clause" – see LICENSE.md for details
 */

/*
Tabs for the open files in a project.
*/

import { Icon } from "@cocalc/frontend/components";
import { Flex } from "antd";

import { CSS } from "@cocalc/frontend/app-framework";
import { file_options } from "@cocalc/frontend/editor-tmp";
import { separate_file_extension } from "@cocalc/util/misc";
import { COLORS } from "@cocalc/util/theme";

interface FileTabActiveFileTopbarProps {
  activeKey: string; // an empty string means there is no active file
  style?: CSS;
}

export function FileTabActiveFileTopbar({
  activeKey,
  style,
}: FileTabActiveFileTopbarProps) {
  function renderIcon() {
    const { icon } = file_options(activeKey);
    return <Icon name={icon} />;
  }

  function renderName() {
    const { name: base, ext = "" } = separate_file_extension(activeKey);

    return (
      <span>
        {base}
        {ext === "" ? undefined : (
          <span style={{ color: COLORS.FILE_EXT }}>{`.${ext}`}</span>
        )}
      </span>
    );
  }

  return (
    <Flex
      justify="left"
      align="center"
      flex={1}
      gap="small"
      style={{
        display: "flex",
        paddingLeft: "5px",
        borderBottom: `1px solid ${COLORS.GRAY_L}`,
        fontSize: "120%",
        ...style,
      }}
    >
      {renderIcon()} {renderName()}
    </Flex>
  );
}
