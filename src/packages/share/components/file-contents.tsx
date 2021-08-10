/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: AGPLv3 s.t. "Commons Clause" – see LICENSE.md for details
 */

import { getExtension } from "lib/util";
import {
  isAudio,
  isCodemirror,
  isImage,
  isMarkdown,
  isVideo,
} from "lib/file-extensions";
import rawURL from "lib/raw-url";
import CodeMirror from "components/codemirror";
import SageWorksheet from "components/sage-worksheet";
import JupyterNotebook from "components/jupyter-notebook";
import { Markdown } from "@cocalc/frontend/markdown";

interface Props {
  id: string;
  content?: string;
  relativePath: string;
  path: string;
}

export default function FileContents({
  id,
  content,
  path,
  relativePath,
}: Props): JSX.Element {
  const filename = relativePath ? relativePath : path;
  const ext = getExtension(filename);
  const raw = rawURL(id, filename);
  if (isImage(ext)) {
    return <img src={raw} style={{ maxWidth: "100%" }} />;
  } else if (isVideo(ext)) {
    return (
      <video
        controls={true}
        autoPlay={true}
        loop={true}
        style={{ width: "100%", height: "auto" }}
        src={raw}
      />
    );
  } else if (isAudio(ext)) {
    return <audio src={raw} autoPlay={true} controls={true} loop={false} />;
  } else if (ext == "pdf") {
    return (
      <embed width="100%" height="100%" src={raw} type="application/pdf" />
    );
  } else if (content == null) {
    // everything below this gets to assume content is not null
    return <div>TODO</div>;
  } else if (isCodemirror(ext)) {
    return <CodeMirror content={content} filename={filename} />;
  } else if (isMarkdown(ext)) {
    return <Markdown value={content} />;
  } else if (ext == "sagews") {
    return <SageWorksheet content={content} />;
  } else if (ext == "ipynb") {
    return <JupyterNotebook content={content} />;
  }
  return <pre>{content}</pre>;
}
